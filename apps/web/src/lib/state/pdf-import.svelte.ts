/**
 * State for the PDF floorplan import dialog: asking for the drawing scale,
 * showing import progress, and reporting errors.
 */

export type PdfImportPhase = 'scale' | 'importing' | 'error';

export const pdfImportState = $state({
	open: false,
	phase: 'scale' as PdfImportPhase,
	/** Page being imported (1-based); 0 while the PDF is still being opened. */
	page: 0,
	pages: 0,
	error: '',
	/** True once the user asked to cancel the running import and it has not stopped yet. */
	cancelling: false
});

/** Cancel flag of the running import. Polled by the import between pages. */
let importCancelRequested = false;

/** Raised when the user cancels: by `requestPdfScale` for the dialog, by the import for a running import. */
export class PdfImportCancelledError extends Error {
	constructor() {
		super('PDF import cancelled');
		this.name = 'PdfImportCancelledError';
	}
}

interface PendingScaleRequest {
	resolve: (denominator: number | null) => void;
	reject: (reason: Error) => void;
}

let pending: PendingScaleRequest | null = null;

/**
 * Open the dialog and ask for the drawing scale.
 * Resolves with the scale denominator (100 for 1:100), or null for "I don't know".
 * Rejects with `PdfImportCancelledError` if the dialog is cancelled or superseded.
 */
export function requestPdfScale(): Promise<number | null> {
	pending?.reject(new PdfImportCancelledError());
	pdfImportState.phase = 'scale';
	pdfImportState.page = 0;
	pdfImportState.pages = 0;
	pdfImportState.error = '';
	pdfImportState.cancelling = false;
	pdfImportState.open = true;
	return new Promise<number | null>((resolve, reject) => {
		pending = { resolve, reject };
	});
}

/** Answer the pending scale request. */
export function submitPdfScale(denominator: number | null): void {
	const request = pending;
	pending = null;
	request?.resolve(denominator);
}

/** Cancel the pending scale request and close the dialog. */
export function cancelPdfScale(): void {
	const request = pending;
	pending = null;
	pdfImportState.open = false;
	request?.reject(new PdfImportCancelledError());
}

/** Start a new import: shows "Opening PDF..." and clears any earlier cancel request. */
export function startPdfImport(): void {
	importCancelRequested = false;
	pdfImportState.cancelling = false;
	showPdfProgress(0, 0);
}

/**
 * Ask the running import to stop. Only has an effect while importing; the import notices
 * at its next check, discards its work and closes the dialog.
 */
export function requestPdfImportCancel(): void {
	if (!pdfImportState.open || pdfImportState.phase !== 'importing') return;
	importCancelRequested = true;
	pdfImportState.cancelling = true;
}

/** Whether the user asked to cancel the running import. */
export function isPdfImportCancelRequested(): boolean {
	return importCancelRequested;
}

/** Show "Importing page i of N" (page 0 means the PDF is still being opened). */
export function showPdfProgress(page: number, pages: number): void {
	pdfImportState.phase = 'importing';
	pdfImportState.page = page;
	pdfImportState.pages = pages;
	pdfImportState.open = true;
}

/** Show a readable error with a Close button. */
export function showPdfError(message: string): void {
	pdfImportState.phase = 'error';
	pdfImportState.error = message;
	pdfImportState.open = true;
}

/** Close the dialog (after success, or when the error is dismissed). */
export function closePdfImport(): void {
	pdfImportState.open = false;
	pdfImportState.cancelling = false;
}
