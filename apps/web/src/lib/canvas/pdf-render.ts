import { pdfRenderScale } from '$canvas/pdf-import-math.js';

/** Readable error raised when a PDF cannot be opened or rendered. The message is safe to show to users. */
export class PdfRenderError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = 'PdfRenderError';
	}
}

export interface RenderedPdfPage {
	/** Object URL of the page rendered as a PNG. The caller owns it and must revoke it. */
	blobUrl: string;
	/** Page width in PDF points (1/72 in), after applying the page rotation. */
	widthPt: number;
	/** Page height in PDF points (1/72 in), after applying the page rotation. */
	heightPt: number;
}

export interface PdfDocumentHandle {
	numPages: number;
	/** Render a page (1-based) to a PNG object URL. */
	renderPage(pageNumber: number): Promise<RenderedPdfPage>;
	/** Release the document and its worker resources. Safe to call more than once. */
	destroy(): Promise<void>;
}

type PdfJs = typeof import('pdfjs-dist');

/** Load pdf.js lazily and point it at the bundled worker. Keeps pdf.js out of the entry chunk. */
async function loadPdfJs(): Promise<PdfJs> {
	const [pdfjs, worker] = await Promise.all([
		import('pdfjs-dist'),
		import('pdfjs-dist/build/pdf.worker.min.mjs?url')
	]);
	pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
	return pdfjs;
}

function toReadableError(pdfjs: PdfJs, e: unknown): PdfRenderError {
	if (e instanceof PdfRenderError) return e;
	if (e instanceof pdfjs.PasswordException) {
		return new PdfRenderError(
			'This PDF is password-protected. Remove the password and try again.',
			{ cause: e }
		);
	}
	if (e instanceof pdfjs.InvalidPDFException) {
		return new PdfRenderError('This file is not a valid PDF or it is corrupted.', { cause: e });
	}
	const detail = e instanceof Error && e.message ? ` (${e.message})` : '';
	return new PdfRenderError(`Could not read the PDF${detail}.`, { cause: e });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new PdfRenderError('Could not convert the rendered page to an image.'));
		}, 'image/png');
	});
}

/**
 * Open a PDF so its pages can be rendered one at a time.
 * Callers must call `destroy()` when done.
 */
export async function openPdf(file: File): Promise<PdfDocumentHandle> {
	const pdfjs = await loadPdfJs();

	let loadingTask: ReturnType<PdfJs['getDocument']> | null = null;
	try {
		const data = new Uint8Array(await file.arrayBuffer());
		loadingTask = pdfjs.getDocument({ data });
		const doc = await loadingTask.promise;
		const task = loadingTask;

		return {
			numPages: doc.numPages,
			async renderPage(pageNumber) {
				let canvas: HTMLCanvasElement | null = null;
				try {
					const page = await doc.getPage(pageNumber);
					try {
						// getViewport applies the page's own rotation by default.
						const base = page.getViewport({ scale: 1 });
						const viewport = page.getViewport({
							scale: pdfRenderScale(base.width, base.height)
						});

						canvas = document.createElement('canvas');
						canvas.width = Math.max(1, Math.round(viewport.width));
						canvas.height = Math.max(1, Math.round(viewport.height));
						const ctx = canvas.getContext('2d');
						if (!ctx) throw new PdfRenderError('Could not create a drawing surface for the page.');
						// PDFs are transparent by default; wall detection needs a white background.
						ctx.fillStyle = '#ffffff';
						ctx.fillRect(0, 0, canvas.width, canvas.height);

						await page.render({ canvas, canvasContext: ctx, viewport }).promise;
						const blob = await canvasToPngBlob(canvas);

						return {
							blobUrl: URL.createObjectURL(blob),
							widthPt: base.width,
							heightPt: base.height
						};
					} finally {
						page.cleanup();
					}
				} catch (e) {
					throw toReadableError(pdfjs, e);
				} finally {
					if (canvas) {
						// Release the backing bitmap right away.
						canvas.width = 0;
						canvas.height = 0;
					}
				}
			},
			async destroy() {
				await task.destroy().catch(() => {});
			}
		};
	} catch (e) {
		if (loadingTask) await loadingTask.destroy().catch(() => {});
		throw toReadableError(pdfjs, e);
	}
}

/**
 * Render every page of a PDF to a PNG object URL.
 * The caller owns the returned URLs and must revoke them.
 */
export async function renderPdfPages(
	file: File,
	onPage?: (i: number, n: number) => void
): Promise<RenderedPdfPage[]> {
	const doc = await openPdf(file);
	const pages: RenderedPdfPage[] = [];
	try {
		for (let i = 1; i <= doc.numPages; i++) {
			onPage?.(i, doc.numPages);
			pages.push(await doc.renderPage(i));
		}
		return pages;
	} catch (e) {
		for (const page of pages) URL.revokeObjectURL(page.blobUrl);
		throw e;
	} finally {
		await doc.destroy();
	}
}
