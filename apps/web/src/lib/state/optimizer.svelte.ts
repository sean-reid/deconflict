import { projectState, updateAp, beginMove } from './project.svelte.js';
import { scheduleSave } from './persistence.svelte.js';
import { decodeMask } from '$canvas/wall-detect.js';
import { OptimizerBridge, type OptimizeProgress } from '../workers/optimizer-bridge.js';

const bridge = new OptimizerBridge();

export const optimizerState = $state({
	isRunning: false,
	progress: 0,
	score: 0,
	error: null as string | null
});

export async function runOptimizer(): Promise<void> {
	if (projectState.aps.length === 0) return;
	if (!projectState.wallMask) return;
	if (optimizerState.isRunning) return;

	optimizerState.isRunning = true;
	optimizerState.progress = 0;
	optimizerState.score = 0;
	optimizerState.error = null;

	try {
		const mask = projectState.wallMask;
		const decoded = await decodeMask(mask.dataUrl, mask.width, mask.height);

		const aps = projectState.aps.map((ap) => ({
			id: ap.id,
			x: ap.x,
			y: ap.y,
			interferenceRadius: ap.interferenceRadius
		}));

		const result = await bridge.optimize(
			aps,
			decoded.data,
			mask.width,
			mask.height,
			projectState.wallAttenuation,
			{
				iterations: 5000,
				onProgress: (p: OptimizeProgress) => {
					optimizerState.progress = Math.round((p.iteration / p.totalIterations) * 100);
					optimizerState.score = Math.round(p.score * 100);
				}
			}
		);

		// Apply optimized positions
		beginMove();
		for (const pos of result.positions) {
			updateAp(pos.id, { x: pos.x, y: pos.y });
		}
		optimizerState.score = Math.round(result.score * 100);
		scheduleSave();
	} catch (err) {
		if (err instanceof Error && err.message === 'Cancelled') {
			// User cancelled - no error
		} else {
			optimizerState.error = err instanceof Error ? err.message : 'Optimization failed';
		}
	} finally {
		optimizerState.isRunning = false;
	}
}

export function cancelOptimizer(): void {
	bridge.cancel();
}
