import { projectState } from '$state/project.svelte.js';
import { scheduleSave } from '$state/persistence.svelte.js';
import { detectBoundary, prepareSvgForDetection } from '$canvas/boundary-detect.js';
import { detectWalls } from '$canvas/wall-detect.js';

const FLOORPLAN_TARGET_WIDTH = 800;

/**
 * Import a floorplan file, run boundary + wall detection, and update project state.
 * Called from both the sidebar drop zone and the canvas drop target.
 */
export async function importFloorplanFile(file: File): Promise<void> {
	const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
	if (!validTypes.includes(file.type)) return;

	if (projectState.floorplanUrl?.startsWith('blob:')) {
		URL.revokeObjectURL(projectState.floorplanUrl);
	}

	const blobUrl = URL.createObjectURL(file);
	projectState.floorplanUrl = blobUrl;
	const isSvg = file.type === 'image/svg+xml';

	try {
		const cleanImg = await prepareSvgForDetection(blobUrl);

		// Boundary detection
		const result = detectBoundary(cleanImg);
		if (result && result.polygon.length >= 3) {
			const cleanScaleFactor = FLOORPLAN_TARGET_WIDTH / cleanImg.naturalWidth;
			projectState.floorplanBoundary = result.polygon.map((p) => ({
				x: p.x * cleanScaleFactor,
				y: p.y * cleanScaleFactor
			}));
			// Area for calibration (stored but not auto-applied without user input)
		}

		// Wall detection
		const wallMask = await detectWalls(cleanImg, FLOORPLAN_TARGET_WIDTH, { skipOcr: isSvg });
		if (wallMask) {
			projectState.wallMask = wallMask;
		}

		scheduleSave();
	} catch (e) {
		console.warn('Floorplan detection failed:', e);
	}
}
