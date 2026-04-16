import { projectState, updateAp, beginMove } from './project.svelte.js';
import { scheduleSave } from './persistence.svelte.js';
import { decodeMask, type DecodedWallMask } from '$canvas/wall-detect.js';
import { decodeMaterialMask } from '$canvas/region-labels.js';
import { WALL_MATERIALS } from '$canvas/materials.js';
import { computeBuildingInterior } from '$canvas/morphology.js';
import { countWallCrossings } from '$lib/rf/propagation.js';
import { labelRooms } from '$canvas/region-labels.js';
import { ROOM_TYPES, getRoomType } from '$canvas/room-types.js';
import { OptimizerBridge, type OptimizeProgress } from '../workers/optimizer-bridge.js';
import { floorState, currentFloor, getFloorSlabAttenuation } from './floor-state.svelte.js';
import { wallState } from './wall-state.svelte.js';
import type { Band } from '@deconflict/channels';

const bridge = new OptimizerBridge();

export const optimizerState = $state({
	isRunning: false,
	progress: 0,
	score: 0,
	coverage: 0, // real-time coverage percentage, updated on AP/mask changes
	error: null as string | null
});

/** Per-floor coverage cache: floorId → { coverage %, sampleCount (proxy for area) }. */
export const floorCoverage = new Map<string, { coverage: number; samples: number }>();

/** Weighted average coverage across all floors with data. */
export function getBuildingCoverage(): number {
	if (floorCoverage.size === 0) return 0;
	let totalWeighted = 0;
	let totalSamples = 0;
	for (const { coverage, samples } of floorCoverage.values()) {
		totalWeighted += coverage * samples;
		totalSamples += samples;
	}
	return totalSamples > 0 ? Math.round(totalWeighted / totalSamples) : 0;
}

// Cached interior sample points and decoded mask for real-time coverage
let cachedMaskUrl: string | null = null;
let cachedRtUrl: string | null = null;
let cachedMask: DecodedWallMask | null = null;
let cachedSamples: Array<{ x: number; y: number }> | null = null;
/** Per-sample density weight. Uses same -1 sentinel / median baseline as optimizer worker. */
let cachedSampleDensity: number[] | null = null;

async function ensureCoverageCache(): Promise<boolean> {
	const mask = projectState.wallMask;
	if (!mask) return false;
	const rtUrl = wallState.roomTypeMask?.dataUrl ?? null;
	if (mask.dataUrl === cachedMaskUrl && rtUrl === cachedRtUrl && cachedMask && cachedSamples)
		return true;

	cachedMask = await decodeMask(mask.dataUrl, mask.width, mask.height);
	cachedMaskUrl = mask.dataUrl;
	cachedRtUrl = rtUrl;

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

	// Reuse buildDensityMap for consistent density computation
	const densityResult = await buildDensityMap(mask.width, mask.height);
	const baseline = densityResult
		? densityResult.medianDensity > 0
			? densityResult.medianDensity
			: 0.3
		: 0.3;

	const sampleCount = Math.min(200, interiorPixels.length);
	const step = interiorPixels.length / sampleCount;
	cachedSamples = [];
	cachedSampleDensity = [];
	for (let i = 0; i < sampleCount; i++) {
		const idx = interiorPixels[Math.floor(i * step)]!;
		cachedSamples.push({ x: idx % mask.width, y: Math.floor(idx / mask.width) });
		if (densityResult) {
			const raw = densityResult.map[idx]!;
			cachedSampleDensity.push(raw >= 0 ? raw : baseline);
		} else {
			cachedSampleDensity.push(1);
		}
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
	const wallDb = projectState.wallAttenuation;
	// Include virtual APs from other floors as fixed signal sources
	const curFloorId = floorState.currentFloorId;
	const localAps = projectState.aps.filter((ap) => ap.floorId === curFloorId);
	const virtualAps: Array<(typeof projectState.aps)[0] & { signalScale: number }> = [];
	for (const otherFloor of floorState.floors) {
		if (otherFloor.id === curFloorId) continue;
		const otherAps = projectState.aps.filter((ap) => ap.floorId === otherFloor.id);
		if (otherAps.length === 0) continue;
		const slabDb = getFloorSlabAttenuation(curFloorId, otherFloor.id, '5ghz' as Band);
		const signalScale = Math.pow(10, -slabDb / 20);
		for (const ap of otherAps) {
			virtualAps.push({ ...ap, signalScale });
		}
	}
	const allAps = [...localAps.map((ap) => ({ ...ap, signalScale: 1 })), ...virtualAps];

	let totalWeighted = 0;
	let totalWeight = 0;
	const densities = cachedSampleDensity ?? [];

	for (let i = 0; i < cachedSamples.length; i++) {
		const sample = cachedSamples[i]!;
		let best = 0;
		for (const ap of allAps) {
			const dx = sample.x - ap.x;
			const dy = sample.y - ap.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const ratio = dist / ap.interferenceRadius;
			if (ratio >= 1.5) continue;
			let signal = Math.pow(1 - ratio / 1.5, 2);
			if (signal > 0.001) {
				// Same wall model as optimizer worker: flat dB per wall crossing
				const crossings = countWallCrossings(data, width, height, ap.x, ap.y, sample.x, sample.y);
				if (crossings > 0) signal *= Math.pow(10, (-crossings * wallDb) / 20);
			}
			signal *= ap.signalScale;
			if (signal > best) best = signal;
		}
		// Same density weighting as optimizer worker evaluateCoverage
		const w = densities[i] ?? 1;
		totalWeighted += best * w;
		totalWeight += w;
	}

	optimizerState.coverage = totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) : 0;

	// Cache per-floor coverage (weighted by sample count as area proxy)
	floorCoverage.set(curFloorId, {
		coverage: optimizerState.coverage,
		samples: cachedSamples.length
	});
}

interface DensityMapResult {
	map: Float32Array;
	medianDensity: number;
}

/**
 * Build a per-pixel device density map (Float32Array, same dims as wall mask).
 * Combines room type default densities with per-region overrides.
 * Returns null if no room type data is available.
 */
async function buildDensityMap(
	maskWidth: number,
	maskHeight: number
): Promise<DensityMapResult | null> {
	const rtMask = wallState.roomTypeMask;
	if (!rtMask || rtMask.width !== maskWidth || rtMask.height !== maskHeight) return null;

	const rtData = await decodeMaterialMask(rtMask.dataUrl, rtMask.width, rtMask.height);
	const floor = currentFloor();
	const overrides = floor.roomDensityOverrides ?? {};

	// -1 = unlabeled (use median baseline), >= 0 = explicit density (including 0)
	const densityMap = new Float32Array(maskWidth * maskHeight).fill(-1);
	let hasAnyLabeled = false;

	// Build type ID → default density lookup
	const typeDensity = new Map<number, number>();
	for (const t of ROOM_TYPES) typeDensity.set(t.id, t.defaultDensity);

	for (let i = 0; i < rtData.length; i++) {
		const typeId = rtData[i]!;
		if (typeId === 0) continue;
		densityMap[i] = typeDensity.get(typeId) ?? 0;
		hasAnyLabeled = true;
	}

	// Apply per-region density overrides if we have room labels
	if (Object.keys(overrides).length > 0) {
		// Need interior + room labels to map pixels to regions
		const wallMaskData = wallState.wallMask;
		if (wallMaskData) {
			const decoded = await decodeMask(
				wallMaskData.dataUrl,
				wallMaskData.width,
				wallMaskData.height
			);
			const { interior } = computeBuildingInterior(decoded.data, maskWidth, maskHeight, {
				maxDim: 200,
				dilateRatio: 0.04,
				minDilateR: 4
			});
			const roomLabels = labelRooms(interior, maskWidth, maskHeight);
			for (let i = 0; i < roomLabels.labels.length; i++) {
				const regionId = roomLabels.labels[i]!;
				if (regionId < 0) continue;
				const override = overrides[String(regionId)];
				if (override !== undefined) {
					densityMap[i] = override;
					hasAnyLabeled = true;
				}
			}
		}
	}

	if (!hasAnyLabeled) return null;

	// Compute median of labeled densities (those >= 0, excluding -1 sentinel)
	const labeled: number[] = [];
	for (let i = 0; i < densityMap.length; i++) {
		if (densityMap[i]! >= 0) labeled.push(densityMap[i]!);
	}
	labeled.sort((a, b) => a - b);
	const medianDensity = labeled.length > 0 ? labeled[Math.floor(labeled.length / 2)]! : 0.3;

	return { map: densityMap, medianDensity };
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
		const fixedAps: Array<{
			x: number;
			y: number;
			interferenceRadius: number;
			signalScale: number;
		}> = [];
		for (const otherFloor of floorState.floors) {
			if (otherFloor.id === curFloorId) continue;
			const otherAps = projectState.aps.filter((ap) => ap.floorId === otherFloor.id);
			if (otherAps.length === 0) continue;
			const slabDb = getFloorSlabAttenuation(curFloorId, otherFloor.id, '5ghz' as Band);
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

		// Decode mask on main thread (has canvas access) and send raw buffer
		const decoded = await decodeMask(mask.dataUrl, mask.width, mask.height);

		// Build density map from room type assignments
		const densityResult = await buildDensityMap(mask.width, mask.height);

		const result = await bridge.optimize(
			localAps,
			decoded.data,
			mask.width,
			mask.height,
			projectState.wallAttenuation,
			{
				fixedAps,
				densityMap: densityResult?.map ?? null,
				medianDensity: densityResult?.medianDensity ?? 0,
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
