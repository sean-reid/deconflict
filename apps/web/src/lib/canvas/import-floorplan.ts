import { projectState } from '$state/project.svelte.js';
import { floorplanState } from '$state/floorplan-state.svelte.js';
import { apState } from '$state/ap-state.svelte.js';
import type { Floor } from '$state/floor-state.svelte.js';
import { scheduleSave } from '$state/persistence.svelte.js';
import { detectBoundary, prepareSvgForDetection } from '$canvas/boundary-detect.js';
import { detectWalls } from '$canvas/wall-detect.js';

const FLOORPLAN_TARGET_WIDTH = 800;

/** MIME types accepted as floorplan uploads. */
export const FLOORPLAN_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

/** Value for the `accept` attribute of floorplan file inputs. */
export const FLOORPLAN_ACCEPT = '.png,.jpg,.jpeg,.svg';

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
	isSvg: boolean,
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
 * Import a floorplan file, run boundary + wall detection, and update project state.
 * Called from the canvas drop target.
 */
export async function importFloorplanFile(file: File): Promise<void> {
	if (!FLOORPLAN_MIME_TYPES.includes(file.type)) return;

	const blobUrl = URL.createObjectURL(file);
	projectState.floorplanUrl = blobUrl;
	const isSvg = file.type === 'image/svg+xml';

	try {
		// Area for calibration is not auto-applied without user input
		const { boundary, wallMask } = await analyzeFloorplan(blobUrl, isSvg, { skipOcr: isSvg });
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
