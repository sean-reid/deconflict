import { projectState, updateAp, beginMove } from './project.svelte.js';
import { scheduleSave } from './persistence.svelte.js';
import { decodeMask, computeWallAttenuation, type DecodedWallMask } from '$canvas/wall-detect.js';
import { WALL_MATERIALS } from '$canvas/materials.js';
import { computeBuildingInterior } from '$canvas/morph-interior.js';
import { OptimizerBridge, type OptimizeProgress } from '../workers/optimizer-bridge.js';

const bridge = new OptimizerBridge();

export const optimizerState = $state({
	isRunning: false,
	progress: 0,
	score: 0,
	coverage: 0, // real-time coverage percentage, updated on AP/mask changes
	error: null as string | null
});

// Cached interior sample points and decoded mask for real-time coverage
let cachedMaskUrl: string | null = null;
let cachedMask: DecodedWallMask | null = null;
let cachedSamples: Array<{ x: number; y: number }> | null = null;

async function ensureCoverageCache(): Promise<boolean> {
	const mask = projectState.wallMask;
	if (!mask) return false;
	if (mask.dataUrl === cachedMaskUrl && cachedMask && cachedSamples) return true;

	cachedMask = await decodeMask(mask.dataUrl, mask.width, mask.height);
	cachedMaskUrl = mask.dataUrl;

	// Compute interior and sample points
	const { interior } = computeBuildingInterior(cachedMask.data, mask.width, mask.height, {
		maxDim: 200,
		dilateRatio: 0.04,
		minDilateR: 4
	});

	const interiorPixels: number[] = [];
	for (let i = 0; i < mask.width * mask.height; i++) {
		if (interior[i]) interiorPixels.push(i);
	}

	const sampleCount = Math.min(200, interiorPixels.length);
	const step = interiorPixels.length / sampleCount;
	cachedSamples = [];
	for (let i = 0; i < sampleCount; i++) {
		const idx = interiorPixels[Math.floor(i * step)]!;
		cachedSamples.push({ x: idx % mask.width, y: Math.floor(idx / mask.width) });
	}

	return cachedSamples.length > 0;
}

/** Compute real-time coverage score from current AP positions */
export async function updateCoverage(): Promise<void> {
	if (projectState.aps.length === 0 || !projectState.wallMask) {
		optimizerState.coverage = 0;
		return;
	}

	if (!(await ensureCoverageCache()) || !cachedMask || !cachedSamples) {
		optimizerState.coverage = 0;
		return;
	}

	const { data, width, height } = cachedMask;
	const defaultDb =
		WALL_MATERIALS[projectState.wallMaterial]?.attenuation ?? projectState.wallAttenuation;
	// Decode material mask if available
	let matData: Uint8Array | null = null;
	if (projectState.materialMask && cachedMask) {
		// Reuse cached mask dimensions for material mask decode
		// For now, material map may not be loaded yet - skip if null
	}
	let totalSignal = 0;

	for (const sample of cachedSamples) {
		let best = 0;
		for (const ap of projectState.aps) {
			const dx = sample.x - ap.x;
			const dy = sample.y - ap.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const ratio = dist / ap.interferenceRadius;
			if (ratio >= 1.5) continue;
			let signal = Math.pow(1 - ratio / 1.5, 2);
			if (signal > 0.001) {
				const wallLoss = computeWallAttenuation(
					{ data, width, height },
					matData,
					WALL_MATERIALS,
					defaultDb,
					ap.x,
					ap.y,
					sample.x,
					sample.y
				);
				if (wallLoss > 0) signal *= Math.pow(10, -wallLoss / 20);
			}
			if (signal > best) best = signal;
		}
		totalSignal += best;
	}

	optimizerState.coverage = Math.round((totalSignal / cachedSamples.length) * 100);
}

export async function runOptimizer(): Promise<void> {
	if (projectState.aps.length === 0) return;
	if (!projectState.wallMask) {
		optimizerState.error = 'Load a floorplan first';
		return;
	}
	if (optimizerState.isRunning) return;

	optimizerState.isRunning = true;
	optimizerState.progress = 0;
	optimizerState.score = 0;
	optimizerState.error = null;

	try {
		const mask = projectState.wallMask;

		const aps = projectState.aps.map((ap) => ({
			id: ap.id,
			x: ap.x,
			y: ap.y,
			interferenceRadius: ap.interferenceRadius
		}));

		// Decode mask on main thread (has canvas access) and send raw buffer
		const decoded = await decodeMask(mask.dataUrl, mask.width, mask.height);

		const result = await bridge.optimize(
			aps,
			decoded.data,
			mask.width,
			mask.height,
			projectState.wallAttenuation,
			{
				iterations: 10000,
				onProgress: (p: OptimizeProgress) => {
					optimizerState.progress = Math.round((p.iteration / p.totalIterations) * 100);
					optimizerState.score = Math.round(p.score * 100);
				}
			}
		);

		// Apply optimized positions - use Math.round to ensure integer coords
		// that clearly differ from originals and trigger reactive updates
		beginMove();
		for (const pos of result.positions) {
			updateAp(pos.id, { x: Math.round(pos.x), y: Math.round(pos.y) });
		}
		optimizerState.score = Math.round(result.score * 100);
		scheduleSave();

		// Force a small state mutation to guarantee canvas reactivity triggers
		projectState.aps = [...projectState.aps];
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
