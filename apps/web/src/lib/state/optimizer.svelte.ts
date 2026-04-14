import { projectState, updateAp, beginMove } from './project.svelte.js';
import { scheduleSave } from './persistence.svelte.js';
import { decodeMask, computeWallAttenuation, type DecodedWallMask } from '$canvas/wall-detect.js';
import { WALL_MATERIALS } from '$canvas/materials.js';
import { FLOOR_MATERIALS } from '$canvas/floor-materials.js';
import { computeBuildingInterior } from '$canvas/morph-interior.js';
import { OptimizerBridge, type OptimizeProgress } from '../workers/optimizer-bridge.js';
import { floorState } from './floor-state.svelte.js';
import type { Band } from '@deconflict/channels';

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
	// Include virtual APs from other floors as fixed signal sources
	const curFloorId = floorState.currentFloorId;
	const curFloor = floorState.floors.find((f) => f.id === curFloorId);
	const localAps = projectState.aps.filter((ap) => ap.floorId === curFloorId);
	const virtualAps: Array<(typeof projectState.aps)[0] & { signalScale: number }> = [];
	if (curFloor) {
		const sorted = [...floorState.floors].sort((a, b) => a.level - b.level);
		for (const otherFloor of floorState.floors) {
			if (otherFloor.id === curFloorId) continue;
			const otherAps = projectState.aps.filter((ap) => ap.floorId === otherFloor.id);
			if (otherAps.length === 0) continue;
			// Compute floor slab attenuation
			const loLevel = Math.min(curFloor.level, otherFloor.level);
			const hiLevel = Math.max(curFloor.level, otherFloor.level);
			let slabDb = 0;
			for (const f of sorted) {
				if (f.level < loLevel || f.level >= hiLevel) continue;
				const upperIdx = sorted.findIndex((s) => s.level === f.level + 1);
				if (upperIdx >= 0) {
					const upper = sorted[upperIdx]!;
					const mat = FLOOR_MATERIALS[upper.floorMaterial];
					if (mat) slabDb += (mat.dbPerMeter['5ghz' as Band] ?? 100) * upper.floorThickness;
				}
			}
			const signalScale = Math.pow(10, -slabDb / 20);
			for (const ap of otherAps) {
				virtualAps.push({ ...ap, signalScale });
			}
		}
	}
	const allAps = [...localAps.map((ap) => ({ ...ap, signalScale: 1 })), ...virtualAps];

	let totalSignal = 0;

	for (const sample of cachedSamples) {
		let best = 0;
		for (const ap of allAps) {
			const dx = sample.x - ap.x;
			const dy = sample.y - ap.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const ratio = dist / ap.interferenceRadius;
			if (ratio >= 1.5) continue;
			let signal = Math.pow(1 - ratio / 1.5, 2);
			if (signal > 0.001) {
				const wallLoss = computeWallAttenuation(
					{ data, width, height, originX: 0, originY: 0 },
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
			signal *= ap.signalScale; // floor slab attenuation for virtual APs
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
		const curFloorId = floorState.currentFloorId;

		// Only optimize APs on the current floor (or all APs if single floor)
		const singleFloor = floorState.floors.length === 1;
		const localAps = projectState.aps
			.filter((ap) => singleFloor || ap.floorId === curFloorId)
			.map((ap) => ({
				id: ap.id,
				x: ap.x,
				y: ap.y,
				interferenceRadius: ap.interferenceRadius
			}));

		if (localAps.length === 0) {
			optimizerState.error = 'No APs on this floor';
			return;
		}

		// Virtual APs from other floors — fixed signal sources (not moved)
		const curFloor = floorState.floors.find((f) => f.id === curFloorId);
		const fixedAps: Array<{
			x: number;
			y: number;
			interferenceRadius: number;
			signalScale: number;
		}> = [];
		if (curFloor) {
			const sorted = [...floorState.floors].sort((a, b) => a.level - b.level);
			for (const otherFloor of floorState.floors) {
				if (otherFloor.id === curFloorId) continue;
				const otherAps = projectState.aps.filter((ap) => ap.floorId === otherFloor.id);
				if (otherAps.length === 0) continue;
				const loLevel = Math.min(curFloor.level, otherFloor.level);
				const hiLevel = Math.max(curFloor.level, otherFloor.level);
				let slabDb = 0;
				for (const f of sorted) {
					if (f.level < loLevel || f.level >= hiLevel) continue;
					const upperIdx = sorted.findIndex((s) => s.level === f.level + 1);
					if (upperIdx >= 0) {
						const upper = sorted[upperIdx]!;
						const mat = FLOOR_MATERIALS[upper.floorMaterial];
						if (mat) slabDb += (mat.dbPerMeter['5ghz' as Band] ?? 100) * upper.floorThickness;
					}
				}
				const signalScale = Math.pow(10, -slabDb / 20);
				for (const ap of otherAps) {
					fixedAps.push({
						x: ap.x,
						y: ap.y,
						interferenceRadius: ap.interferenceRadius,
						signalScale
					});
				}
			}
		}

		// Decode mask on main thread (has canvas access) and send raw buffer
		const decoded = await decodeMask(mask.dataUrl, mask.width, mask.height);

		const result = await bridge.optimize(
			localAps,
			decoded.data,
			mask.width,
			mask.height,
			projectState.wallAttenuation,
			{
				fixedAps,
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
