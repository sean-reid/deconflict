import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	scheduleSave: vi.fn(),
	pushState: vi.fn(),
	openPdf: vi.fn(),
	detectBoundary: vi.fn(),
	detectWalls: vi.fn()
}));

vi.mock('$state/persistence.svelte.js', () => ({ scheduleSave: mocks.scheduleSave }));
vi.mock('$state/history.svelte.js', () => ({ pushState: mocks.pushState }));
vi.mock('$canvas/pdf-render.js', () => ({
	openPdf: mocks.openPdf,
	PdfRenderError: class PdfRenderError extends Error {}
}));
vi.mock('$canvas/boundary-detect.js', () => ({
	// The "image" is just the page URL with a natural width of 1600 (scaled to 800 by the analysis).
	prepareSvgForDetection: async (url: string) => ({ url, naturalWidth: 1600 }),
	detectBoundary: mocks.detectBoundary
}));
vi.mock('$canvas/wall-detect.js', () => ({ detectWalls: mocks.detectWalls }));

import { apState } from '$state/ap-state.svelte.js';
import { floorState } from '$state/floor-state.svelte.js';
import { floorplanState } from '$state/floorplan-state.svelte.js';
import { wallState } from '$state/wall-state.svelte.js';
import {
	PdfImportCancelledError,
	cancelPdfScale,
	closePdfImport,
	pdfImportState,
	requestPdfImportCancel,
	startPdfImport,
	submitPdfScale
} from '$state/pdf-import.svelte.js';
import { wupmFromScale } from '$canvas/pdf-import-math.js';
import { importPdfFloorplan, runPdfImportFlow } from './import-floorplan.js';

const PAGE_WIDTHS_PT = [1190.55, 841.89, 595.28];
const pageUrl = (i: number) => `blob:page-${i}`;
const maskFor = (i: number) => ({
	dataUrl: `mask-${i}`,
	width: 800,
	height: 600,
	originX: 0,
	originY: 0
});

interface FakeDoc {
	numPages: number;
	renderPage: ReturnType<typeof vi.fn>;
	destroy: ReturnType<typeof vi.fn>;
}

/** A fake pdf.js document. `renderPage` can be overridden per test to fail a page. */
function fakeDoc(numPages: number, renderPage?: (i: number) => Promise<unknown>): FakeDoc {
	const doc: FakeDoc = {
		numPages,
		renderPage: vi.fn(
			renderPage ??
				(async (i: number) => ({
					blobUrl: pageUrl(i),
					widthPt: PAGE_WIDTHS_PT[i - 1]!,
					heightPt: 842
				}))
		),
		destroy: vi.fn(async () => {})
	};
	mocks.openPdf.mockResolvedValue(doc);
	return doc;
}

function resetProjectState(): void {
	floorState.floors = floorState.floors.slice(0, 1);
	const floor = floorState.floors[0]!;
	floorState.currentFloorId = floor.id;
	floor.floorplanUrl = null;
	floor.floorplanBoundary = null;
	floor.wallMask = null;
	floor.calibration = null;
	floorplanState.floorplanUrl = null;
	floorplanState.floorplanBoundary = null;
	floorplanState.calibration = null;
	wallState.wallMask = null;
	apState.aps = [];
}

const file = () => new File([new Uint8Array([1])], 'plan.pdf', { type: 'application/pdf' });

/** Start the flow, answer the scale dialog, and wait for the flow to finish. */
async function runFlow(scale: number | null) {
	const run = runPdfImportFlow(file());
	submitPdfScale(scale);
	return run;
}

describe('PDF import orchestration', () => {
	let revoked: string[];

	beforeEach(() => {
		vi.clearAllMocks();
		revoked = [];
		vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => {
			revoked.push(url);
		});

		// Page i (identified by its URL) gets boundary [(i,i),(i+1,i),(i,i+1)] and areaPx 1000 * i.
		mocks.detectBoundary.mockImplementation((img: { url: string }) => {
			const i = Number(img.url.split('-')[1]);
			return {
				polygon: [
					{ x: i * 2, y: i * 2 },
					{ x: i * 2 + 2, y: i * 2 },
					{ x: i * 2, y: i * 2 + 2 }
				],
				areaPx: 1000 * i
			};
		});
		mocks.detectWalls.mockImplementation(async (img: { url: string }) =>
			maskFor(Number(img.url.split('-')[1]))
		);

		cancelPdfScale();
		startPdfImport(); // clears the cancel flag
		closePdfImport();
		pdfImportState.error = '';
		resetProjectState();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('imports a 3-page PDF as the current floor plus two new floors', async () => {
		const doc = fakeDoc(3);
		const firstFloorId = floorState.currentFloorId;

		const result = await runFlow(100);

		const wupm = PAGE_WIDTHS_PT.map((w) => wupmFromScale(w, 100));
		// Boundary points are halved: the analysis scales 1600 px wide pages to 800.
		const boundary = (i: number) => [
			{ x: i, y: i },
			{ x: i + 1, y: i },
			{ x: i, y: i + 1 }
		];

		expect(result).not.toBeNull();
		expect(result!.scaleDenominator).toBe(100);
		expect(result!.analysis).toEqual({
			boundary: boundary(1),
			worldArea: 1000 * 0.25,
			wallMask: maskFor(1)
		});

		// Page 1 replaces the floorplan of the current floor, which is not switched.
		expect(floorState.floors).toHaveLength(3);
		expect(floorState.currentFloorId).toBe(firstFloorId);
		expect(floorplanState.floorplanUrl).toBe(pageUrl(1));
		expect(floorplanState.floorplanBoundary).toEqual(boundary(1));
		expect(wallState.wallMask).toEqual(maskFor(1));
		expect(floorplanState.calibration).toEqual({ worldUnitsPerMeter: wupm[0] });

		// Pages 2 and 3 are written straight into new floors.
		for (const i of [2, 3]) {
			const floor = floorState.floors[i - 1]!;
			expect(floor.floorplanUrl).toBe(pageUrl(i));
			expect(floor.floorplanBoundary).toEqual(boundary(i));
			expect(floor.wallMask).toEqual(maskFor(i));
			expect(floor.calibration).toEqual({ worldUnitsPerMeter: wupm[i - 1] });
		}

		expect(mocks.pushState).toHaveBeenCalledTimes(1);
		expect(mocks.scheduleSave).toHaveBeenCalled();
		expect(revoked).toEqual([]);
		expect(doc.destroy).toHaveBeenCalledTimes(1);
		expect(pdfImportState.open).toBe(false);
	});

	it('takes the undo snapshot before any state changes', async () => {
		fakeDoc(3);
		mocks.pushState.mockImplementation(() => {
			expect(floorState.floors).toHaveLength(1);
			expect(floorplanState.floorplanUrl).toBeNull();
		});

		await runFlow(100);

		expect(mocks.pushState).toHaveBeenCalledTimes(1);
		expect(floorState.floors).toHaveLength(3);
	});

	it('leaves calibrations unset when the scale is unknown', async () => {
		fakeDoc(2);

		const result = await runFlow(null);

		expect(result!.scaleDenominator).toBeNull();
		expect(floorplanState.calibration).toBeNull();
		expect(floorState.floors[1]!.calibration).toBeNull();
		expect(floorState.floors[1]!.floorplanUrl).toBe(pageUrl(2));
	});

	it('leaves the project untouched and revokes the pages when a page fails', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const doc = fakeDoc(3, async (i) => {
			if (i === 2) throw new Error('page 2 is broken');
			return { blobUrl: pageUrl(i), widthPt: PAGE_WIDTHS_PT[i - 1]!, heightPt: 842 };
		});

		const result = await runFlow(100);

		expect(result).toBeNull();
		expect(mocks.pushState).not.toHaveBeenCalled();
		expect(floorState.floors).toHaveLength(1);
		expect(floorplanState.floorplanUrl).toBeNull();
		expect(floorplanState.floorplanBoundary).toBeNull();
		expect(floorplanState.calibration).toBeNull();
		expect(wallState.wallMask).toBeNull();
		expect(revoked).toEqual([pageUrl(1)]);
		expect(doc.destroy).toHaveBeenCalledTimes(1);
		expect(doc.renderPage).toHaveBeenCalledTimes(2);
		expect(pdfImportState).toMatchObject({ open: true, phase: 'error' });
		expect(pdfImportState.error).not.toBe('');
	});

	it('discards a cancelled import without an error', async () => {
		const doc = fakeDoc(3);
		// The user presses Cancel while page 2 is being analysed.
		mocks.detectBoundary.mockImplementation((img: { url: string }) => {
			if (img.url === pageUrl(2)) requestPdfImportCancel();
			return null;
		});

		const result = await runFlow(100);

		expect(result).toBeNull();
		expect(mocks.pushState).not.toHaveBeenCalled();
		expect(floorState.floors).toHaveLength(1);
		expect(floorplanState.floorplanUrl).toBeNull();
		expect(wallState.wallMask).toBeNull();
		expect(floorplanState.calibration).toBeNull();
		// Page 3 is never rendered; both finished pages are freed.
		expect(doc.renderPage).toHaveBeenCalledTimes(2);
		expect(revoked).toEqual([pageUrl(1), pageUrl(2)]);
		expect(doc.destroy).toHaveBeenCalledTimes(1);
		expect(pdfImportState).toMatchObject({ open: false, error: '', cancelling: false });
		expect(mocks.scheduleSave).not.toHaveBeenCalled();
	});

	it('honours a cancel pressed during the last page, before the undo snapshot', async () => {
		const doc = fakeDoc(3);
		mocks.detectBoundary.mockImplementation((img: { url: string }) => {
			if (img.url === pageUrl(3)) requestPdfImportCancel();
			return null;
		});

		const result = await runFlow(100);

		expect(result).toBeNull();
		expect(mocks.pushState).not.toHaveBeenCalled();
		expect(floorState.floors).toHaveLength(1);
		expect(floorplanState.floorplanUrl).toBeNull();
		expect(revoked).toEqual([pageUrl(1), pageUrl(2), pageUrl(3)]);
		expect(doc.destroy).toHaveBeenCalledTimes(1);
		expect(pdfImportState).toMatchObject({ open: false, error: '' });
	});

	it('rejects importPdfFloorplan with a cancellation error', async () => {
		fakeDoc(2);
		startPdfImport();
		requestPdfImportCancel();

		await expect(importPdfFloorplan(file(), 100)).rejects.toBeInstanceOf(PdfImportCancelledError);

		expect(mocks.pushState).not.toHaveBeenCalled();
		expect(floorState.floors).toHaveLength(1);
	});

	it('does not carry a cancel over to the next import', async () => {
		fakeDoc(2);
		mocks.detectBoundary.mockImplementationOnce(() => {
			requestPdfImportCancel();
			return null;
		});
		expect(await runFlow(100)).toBeNull();

		fakeDoc(2);
		mocks.detectBoundary.mockImplementation(() => null);
		const result = await runFlow(100);

		expect(result).not.toBeNull();
		expect(floorState.floors).toHaveLength(2);
		expect(mocks.pushState).toHaveBeenCalledTimes(1);
	});
});
