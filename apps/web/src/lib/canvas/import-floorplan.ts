import { projectState } from '$state/project.svelte.js';
import { floorplanState } from '$state/floorplan-state.svelte.js';
import { wallState } from '$state/wall-state.svelte.js';
import { apState } from '$state/ap-state.svelte.js';
import { addFloor, getFloor } from '$state/floor-state.svelte.js';
import type { Floor } from '$state/floor-state.svelte.js';
import { pushState } from '$state/history.svelte.js';
import {
	PdfImportCancelledError,
	closePdfImport,
	isPdfImportCancelRequested,
	pdfImportState,
	requestPdfScale,
	showPdfError,
	showPdfProgress,
	startPdfImport
} from '$state/pdf-import.svelte.js';
import { scheduleSave } from '$state/persistence.svelte.js';
import { detectBoundary, prepareSvgForDetection } from '$canvas/boundary-detect.js';
import { detectWalls } from '$canvas/wall-detect.js';
import { isPdfFile, wupmFromScale } from '$canvas/pdf-import-math.js';
import { PdfRenderError, openPdf } from '$canvas/pdf-render.js';

const FLOORPLAN_TARGET_WIDTH = 800;

/** MIME types accepted as floorplan uploads. */
export const FLOORPLAN_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

/** Value for the `accept` attribute of floorplan file inputs. */
export const FLOORPLAN_ACCEPT = '.png,.jpg,.jpeg,.svg,.pdf';

export interface FloorplanAnalysis {
	/** Boundary polygon in world coordinates (scaled to the target width), or null if none found. */
	boundary: { x: number; y: number }[] | null;
	/** Detected boundary area in world units squared, or null if no boundary was found. */
	worldArea: number | null;
	wallMask: Floor['wallMask'];
}

/**
 * Run boundary + wall detection on a floorplan image URL.
 * Pure analysis: does not read or write any application state.
 */
export async function analyzeFloorplan(
	url: string,
	opts?: { skipOcr?: boolean }
): Promise<FloorplanAnalysis> {
	// For SVGs, strip text for cleaner boundary detection
	const cleanImg = await prepareSvgForDetection(url);

	let boundary: FloorplanAnalysis['boundary'] = null;
	let worldArea: number | null = null;

	const result = detectBoundary(cleanImg);
	if (result && result.polygon.length >= 3) {
		const cleanScaleFactor = FLOORPLAN_TARGET_WIDTH / cleanImg.naturalWidth;
		boundary = result.polygon.map((p) => ({
			x: p.x * cleanScaleFactor,
			y: p.y * cleanScaleFactor
		}));
		// Use the actual pixel area from boundary detection, scaled to world coords.
		// Morphological close ensures door gaps don't leak flood fill but area
		// isn't inflated by the dilation step.
		worldArea = result.areaPx * cleanScaleFactor * cleanScaleFactor;
	}

	const wallMask = await detectWalls(cleanImg, FLOORPLAN_TARGET_WIDTH, opts);

	return { boundary, worldArea, wallMask };
}

/**
 * Set the floorplan calibration (world units per meter) and rescale AP radii.
 * First calibration turns uncalibrated APs (radius 150) into a real 15 m radius;
 * recalibration scales all radii proportionally to preserve real-world meters.
 */
export function applyWupm(worldUnitsPerMeter: number): void {
	const oldCalibration = floorplanState.calibration;
	floorplanState.calibration = { worldUnitsPerMeter };

	if (oldCalibration === null) {
		// First calibration: set uncalibrated APs (radius=150) to real 15m
		const defaultRadiusWorld = Math.round(15 * worldUnitsPerMeter);
		for (const ap of apState.aps) {
			if (ap.interferenceRadius === 150) {
				ap.interferenceRadius = defaultRadiusWorld;
			}
		}
	} else {
		// Recalibration: scale all AP radii proportionally to preserve real-world meters
		const ratio = worldUnitsPerMeter / oldCalibration.worldUnitsPerMeter;
		for (const ap of apState.aps) {
			ap.interferenceRadius = Math.round(ap.interferenceRadius * ratio);
		}
	}

	scheduleSave();
}

/**
 * Reset the current floor's calibration for a newly imported PDF page 1.
 * Without a scale the calibration is cleared, as for an image import. With a scale, the
 * previous calibration is kept until `applyWupm` runs, so AP radii are rescaled
 * proportionally (or the default 150 becomes 15 m when there was no previous calibration).
 */
export function calibrateCurrentFloorForPdfPage(wupm: number | null): void {
	if (wupm === null) {
		floorplanState.calibration = null;
		return;
	}
	// Keep the previous calibration: applyWupm compares against it to rescale the AP radii.
	applyWupm(wupm);
}

function throwIfCancelled(): void {
	if (isPdfImportCancelRequested()) throw new PdfImportCancelledError();
}

interface AnalyzedPdfPage {
	blobUrl: string;
	analysis: FloorplanAnalysis;
	/** World units per metre for this page, or null when no scale was given. */
	wupm: number | null;
}

/**
 * Import a PDF floorplan: one floor per page. Page 1 replaces the floorplan of the
 * current floor; pages 2..N are added as new floors (the current floor is not switched).
 * Every page is rendered and analysed before any state changes, so a failure or a cancel
 * (see `requestPdfImportCancel`) leaves the project untouched and records no undo step;
 * a cancel rejects with `PdfImportCancelledError`. Returns the page-1 analysis so callers
 * can offer area calibration when no scale was given.
 */
export async function importPdfFloorplan(
	file: File,
	scaleDenominator: number | null,
	onProgress?: (i: number, n: number) => void
): Promise<FloorplanAnalysis | null> {
	const doc = await openPdf(file);
	const pages: AnalyzedPdfPage[] = [];
	try {
		for (let i = 1; i <= doc.numPages; i++) {
			throwIfCancelled();
			onProgress?.(i, doc.numPages);
			const rendered = await doc.renderPage(i);
			let analysis: FloorplanAnalysis = { boundary: null, worldArea: null, wallMask: null };
			try {
				// Rendered PDFs contain text, so OCR is not skipped.
				analysis = await analyzeFloorplan(rendered.blobUrl, { skipOcr: false });
			} catch (e) {
				console.warn(`Floorplan detection failed for PDF page ${i}:`, e);
			}
			pages.push({
				blobUrl: rendered.blobUrl,
				analysis,
				wupm: scaleDenominator === null ? null : wupmFromScale(rendered.widthPt, scaleDenominator)
			});
		}
		throwIfCancelled();
	} catch (e) {
		for (const page of pages) URL.revokeObjectURL(page.blobUrl);
		throw e;
	} finally {
		await doc.destroy();
	}

	// Closing the document yields, so a Cancel pressed meanwhile is only seen here.
	if (isPdfImportCancelRequested()) {
		for (const page of pages) URL.revokeObjectURL(page.blobUrl);
		throw new PdfImportCancelledError();
	}

	const [first, ...rest] = pages;
	if (!first) return null;

	pushState();

	// Page 1: same resets and writes as an image import, on the current floor.
	floorplanState.floorplanUrl = first.blobUrl;
	calibrateCurrentFloorForPdfPage(first.wupm);
	floorplanState.floorplanBoundary = null;
	if (first.analysis.boundary) floorplanState.floorplanBoundary = first.analysis.boundary;
	if (first.analysis.wallMask) wallState.wallMask = first.analysis.wallMask;

	// Pages 2..N: new floors, written straight into their Floor objects.
	for (const page of rest) {
		const added = addFloor();
		// Write through the reactive proxy held by floorState rather than the raw object.
		const floor = getFloor(added.id) ?? added;
		floor.floorplanUrl = page.blobUrl;
		floor.floorplanBoundary = page.analysis.boundary;
		floor.wallMask = page.analysis.wallMask;
		if (page.wupm !== null) floor.calibration = { worldUnitsPerMeter: page.wupm };
	}

	scheduleSave();
	return first.analysis;
}

export interface PdfImportFlowResult {
	/** Scale denominator chosen in the dialog, or null for "I don't know". */
	scaleDenominator: number | null;
	/** Analysis of page 1, or null if no pages were imported. */
	analysis: FloorplanAnalysis | null;
}

/**
 * Entry point for PDF floorplans (sidebar and canvas drop): asks for the drawing scale,
 * imports one floor per page while showing progress, and shows a readable error on failure.
 * Returns null if the user cancelled (before or during the import), another PDF import is in
 * progress, or the import failed.
 */
export async function runPdfImportFlow(file: File): Promise<PdfImportFlowResult | null> {
	if (pdfImportState.open) return null;

	let scaleDenominator: number | null;
	try {
		scaleDenominator = await requestPdfScale();
	} catch (e) {
		if (e instanceof PdfImportCancelledError) return null;
		throw e;
	}

	try {
		startPdfImport();
		const analysis = await importPdfFloorplan(file, scaleDenominator, showPdfProgress);
		closePdfImport();
		return { scaleDenominator, analysis };
	} catch (e) {
		if (e instanceof PdfImportCancelledError || isPdfImportCancelRequested()) {
			// The user cancelled: nothing was imported and there is nothing to report.
			closePdfImport();
			return null;
		}
		console.warn('PDF import failed:', e);
		showPdfError(e instanceof PdfRenderError ? e.message : 'Could not import this PDF.');
		return null;
	}
}

/**
 * Import a floorplan file, run boundary + wall detection, and update project state.
 * Called from the canvas drop target. PDFs go through the PDF flow (scale dialog, one
 * floor per page) and record their own undo step; images are placed on the current floor.
 */
export async function importFloorplanFile(file: File): Promise<void> {
	if (isPdfFile(file)) {
		await runPdfImportFlow(file);
		return;
	}
	if (!FLOORPLAN_MIME_TYPES.includes(file.type)) return;

	const blobUrl = URL.createObjectURL(file);
	projectState.floorplanUrl = blobUrl;
	const isSvg = file.type === 'image/svg+xml';

	try {
		// Area for calibration is not auto-applied without user input
		const { boundary, wallMask } = await analyzeFloorplan(blobUrl, { skipOcr: isSvg });
		if (boundary) {
			projectState.floorplanBoundary = boundary;
		}
		if (wallMask) {
			projectState.wallMask = wallMask;
		}

		scheduleSave();
	} catch (e) {
		console.warn('Floorplan detection failed:', e);
	}
}
