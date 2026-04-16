/// <reference lib="webworker" />

import { computeBuildingInterior } from '../canvas/morphology.js';
import { signalStrengthOptimizer, countWallCrossings } from '../rf/propagation.js';

interface ApInput {
	id: string;
	x: number;
	y: number;
	interferenceRadius: number;
}

interface FixedApInput {
	x: number;
	y: number;
	interferenceRadius: number;
	signalScale: number; // floor slab attenuation factor (0-1)
}

interface OptimizeMessage {
	type: 'optimize';
	aps: ApInput[];
	fixedAps: FixedApInput[];
	wallMask: Uint8Array;
	maskWidth: number;
	maskHeight: number;
	wallAttenuation: number;
	iterations: number;
	/** Per-pixel device density (devices/sqm). 0 = unlabeled. Null = no room data. */
	densityMap: Float32Array | null;
	/** Median density of labeled rooms — used as baseline for unlabeled pixels. */
	medianDensity: number;
}

interface CancelMessage {
	type: 'cancel';
}

type InMessage = OptimizeMessage | CancelMessage;

let cancelled = false;

self.onmessage = (event: MessageEvent<InMessage>) => {
	const msg = event.data;
	if (msg.type === 'cancel') {
		cancelled = true;
		return;
	}
	if (msg.type === 'optimize') {
		cancelled = false;
		runOptimization(msg).catch((err) => {
			self.postMessage({
				type: 'result',
				positions: msg.aps.map((a) => ({ id: a.id, x: a.x, y: a.y })),
				score: 0,
				improvement: 0,
				error: String(err)
			});
		});
	}
};

// ─── Precomputed wall-crossing cache ────────────────────────────────
// Built ONCE before optimization. Maps from a fixed grid of source
// positions to sample points. AP positions snap to nearest grid source
// via O(1) grid lookup (no linear scan).

interface WallCache {
	/** dB attenuation from source i to sample j: table[i * numSamples + j] */
	table: Float32Array;
	numSources: number;
	numSamples: number;
	/** Grid-cell → source index lookup. -1 = no source in that cell. */
	gridLookup: Int32Array;
	gridStep: number;
	gridCols: number;
	gridRows: number;
	srcX: Float32Array;
	srcY: Float32Array;
}

function buildWallCache(
	mask: Uint8Array,
	w: number,
	h: number,
	interior: Uint8Array,
	samples: Array<{ x: number; y: number }>,
	wallAttenuation: number
): WallCache {
	const gridStep = 8;
	const gridCols = Math.ceil(w / gridStep);
	const gridRows = Math.ceil(h / gridStep);

	// Build grid-to-source mapping
	const gridLookup = new Int32Array(gridCols * gridRows).fill(-1);
	const srcXArr: number[] = [];
	const srcYArr: number[] = [];

	for (let gr = 0; gr < gridRows; gr++) {
		for (let gc = 0; gc < gridCols; gc++) {
			const wx = gc * gridStep;
			const wy = gr * gridStep;
			if (wx < w && wy < h && interior[wy * w + wx]) {
				gridLookup[gr * gridCols + gc] = srcXArr.length;
				srcXArr.push(wx);
				srcYArr.push(wy);
			}
		}
	}

	const numSources = srcXArr.length;
	const numSamples = samples.length;
	// Use Float32 to store dB attenuation (not just crossing count)
	const table = new Float32Array(numSources * numSamples);

	for (let si = 0; si < numSources; si++) {
		for (let sj = 0; sj < numSamples; sj++) {
			// Stride-3 DDA for fast cache build. Use flat dB per crossing.
			const crossings = countWallCrossings(
				mask,
				w,
				h,
				srcXArr[si]!,
				srcYArr[si]!,
				samples[sj]!.x,
				samples[sj]!.y,
				3
			);
			table[si * numSamples + sj] = crossings * wallAttenuation;
		}
	}

	return {
		table,
		numSources,
		numSamples,
		gridLookup,
		gridStep,
		gridCols,
		gridRows,
		srcX: new Float32Array(srcXArr),
		srcY: new Float32Array(srcYArr)
	};
}

/** O(1) grid-based source lookup — replaces linear scan. */
function nearestSourceIdx(cache: WallCache, x: number, y: number): number {
	const gc = Math.round(x / cache.gridStep);
	const gr = Math.round(y / cache.gridStep);

	// Check the target cell and its 8 neighbors (handles off-grid positions)
	let bestIdx = -1;
	let bestDist = Infinity;
	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			const r = gr + dr;
			const c = gc + dc;
			if (r < 0 || r >= cache.gridRows || c < 0 || c >= cache.gridCols) continue;
			const idx = cache.gridLookup[r * cache.gridCols + c]!;
			if (idx < 0) continue;
			const dx = cache.srcX[idx]! - x;
			const dy = cache.srcY[idx]! - y;
			const d = dx * dx + dy * dy;
			if (d < bestDist) {
				bestDist = d;
				bestIdx = idx;
			}
		}
	}

	// Fallback: if no neighbor found, scan (rare — only at building edges)
	if (bestIdx < 0) {
		for (let i = 0; i < cache.numSources; i++) {
			const dx = cache.srcX[i]! - x;
			const dy = cache.srcY[i]! - y;
			const d = dx * dx + dy * dy;
			if (d < bestDist) {
				bestDist = d;
				bestIdx = i;
			}
		}
	}
	return bestIdx;
}

// ─── Evaluation ─────────────────────────────────────────────────────

interface Position {
	id: string;
	x: number;
	y: number;
	radius: number;
}

function evaluateCoverage(
	positions: Position[],
	samples: Array<{ x: number; y: number }>,
	cache: WallCache,
	fixedAps: FixedApInput[] = [],
	sampleDensity: number[] = []
): number {
	let totalWeighted = 0;
	let totalWeight = 0;
	for (let s = 0; s < samples.length; s++) {
		let best = 0;
		for (const ap of positions) {
			const dx = samples[s]!.x - ap.x;
			const dy = samples[s]!.y - ap.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			let signal = signalStrengthOptimizer(dist, ap.radius);
			if (signal > 0.001) {
				const srcIdx = nearestSourceIdx(cache, ap.x, ap.y);
				if (srcIdx >= 0) {
					const dbLoss = cache.table[srcIdx * cache.numSamples + s]!;
					if (dbLoss > 0) signal *= Math.pow(10, -dbLoss / 20);
				}
			}
			if (signal > best) best = signal;
		}
		// Include fixed APs from other floors (attenuated by floor slab)
		for (const fap of fixedAps) {
			const dx = samples[s]!.x - fap.x;
			const dy = samples[s]!.y - fap.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			let signal = signalStrengthOptimizer(dist, fap.interferenceRadius) * fap.signalScale;
			if (signal > 0.001) {
				const srcIdx = nearestSourceIdx(cache, fap.x, fap.y);
				if (srcIdx >= 0) {
					const dbLoss = cache.table[srcIdx * cache.numSamples + s]!;
					if (dbLoss > 0) signal *= Math.pow(10, -dbLoss / 20);
				}
			}
			if (signal > best) best = signal;
		}
		const w = sampleDensity[s] ?? 1;
		totalWeighted += best * w;
		totalWeight += w;
	}
	return totalWeight > 0 ? totalWeighted / totalWeight : 0;
}

function evaluateExact(
	positions: Position[],
	samples: Array<{ x: number; y: number }>,
	mask: Uint8Array,
	w: number,
	h: number,
	wallAttenuation: number,
	fixedAps: FixedApInput[] = []
): number {
	let total = 0;
	for (const sample of samples) {
		let best = 0;
		for (const ap of positions) {
			const dx = sample.x - ap.x;
			const dy = sample.y - ap.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			let signal = signalStrengthOptimizer(dist, ap.radius);
			if (signal > 0.001) {
				const crossings = countWallCrossings(mask, w, h, ap.x, ap.y, sample.x, sample.y);
				if (crossings > 0) signal *= Math.pow(10, (-crossings * wallAttenuation) / 20);
			}
			if (signal > best) best = signal;
		}
		for (const fap of fixedAps) {
			const dx = sample.x - fap.x;
			const dy = sample.y - fap.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			let signal = signalStrengthOptimizer(dist, fap.interferenceRadius) * fap.signalScale;
			if (signal > 0.001) {
				const crossings = countWallCrossings(mask, w, h, fap.x, fap.y, sample.x, sample.y);
				if (crossings > 0) signal *= Math.pow(10, (-crossings * wallAttenuation) / 20);
			}
			if (signal > best) best = signal;
		}
		total += best;
	}
	return total / samples.length;
}

function snapToInterior(
	x: number,
	y: number,
	interiorPixels: number[],
	w: number
): { x: number; y: number } {
	let bestDist = Infinity;
	let bestIdx = interiorPixels[0]!;
	for (const px of interiorPixels) {
		const d = ((px % w) - x) ** 2 + (Math.floor(px / w) - y) ** 2;
		if (d < bestDist) {
			bestDist = d;
			bestIdx = px;
		}
	}
	return { x: bestIdx % w, y: Math.floor(bestIdx / w) };
}

// ─── Yield to event loop for cancel checks ──────────────────────────

function yieldToEventLoop(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

// ─── Main optimization pipeline ─────────────────────────────────────

async function runOptimization(msg: OptimizeMessage): Promise<void> {
	const {
		aps,
		fixedAps,
		wallMask: mask,
		maskWidth: w,
		maskHeight: h,
		wallAttenuation,
		densityMap,
		medianDensity
	} = msg;

	const { interior } = computeBuildingInterior(mask, w, h, {
		maxDim: 200,
		dilateRatio: 0.04,
		minDilateR: 4
	});

	if (cancelled) {
		self.postMessage({ type: 'cancelled' });
		return;
	}

	const interiorPixels: number[] = [];
	for (let i = 0; i < w * h; i++) {
		if (interior[i]) interiorPixels.push(i);
	}

	if (interiorPixels.length === 0 || aps.length === 0) {
		self.postMessage({
			type: 'result',
			positions: aps.map((a) => ({ id: a.id, x: a.x, y: a.y })),
			score: 0,
			improvement: 0
		});
		return;
	}

	const numAps = aps.length;
	const baseline = medianDensity > 0 ? medianDensity : 0.3;

	// Sample points — density-weighted if room type data is available
	const sampleCount = Math.min(400, interiorPixels.length);
	const samples: Array<{ x: number; y: number }> = [];
	/** Per-sample density weight (1.0 = unassigned/default). */
	const sampleDensity: number[] = [];

	if (densityMap && densityMap.length === w * h) {
		// Weighted sampling: unlabeled pixels use median density as baseline
		const weights = new Float32Array(interiorPixels.length);
		let totalWeight = 0;
		for (let i = 0; i < interiorPixels.length; i++) {
			const raw = densityMap[interiorPixels[i]!]!;
			// 0 = unlabeled → use baseline; otherwise use actual density
			const d = raw > 0 ? raw : baseline;
			weights[i] = d;
			totalWeight += d;
		}

		// Systematic weighted resampling (deterministic, no randomness)
		const stepW = totalWeight / sampleCount;
		let cum = 0;
		let nextThreshold = stepW * 0.5; // start at half-step for centering
		let pi = 0;
		for (let s = 0; s < sampleCount && pi < interiorPixels.length; s++) {
			while (pi < interiorPixels.length - 1 && cum + weights[pi]! < nextThreshold) {
				cum += weights[pi]!;
				pi++;
			}
			const idx = interiorPixels[pi]!;
			samples.push({ x: idx % w, y: Math.floor(idx / w) });
			const raw = densityMap[idx]!;
			sampleDensity.push(raw > 0 ? raw : baseline);
			nextThreshold += stepW;
			cum += weights[pi]!;
			pi++;
		}
	} else {
		// Uniform sampling (no density data)
		const step = interiorPixels.length / sampleCount;
		for (let i = 0; i < sampleCount; i++) {
			const idx = interiorPixels[Math.floor(i * step)]!;
			samples.push({ x: idx % w, y: Math.floor(idx / w) });
			sampleDensity.push(0);
		}
	}

	// Build wall cache ONCE (stride-3 DDA, O(1) grid lookup)
	self.postMessage({
		type: 'progress',
		positions: [],
		score: 0,
		iteration: 0,
		totalIterations: 100,
		stage: 'Precomputing...'
	});
	const cache = buildWallCache(mask, w, h, interior, samples, wallAttenuation);

	// Yield to let cancel message arrive
	await yieldToEventLoop();
	if (cancelled) {
		self.postMessage({ type: 'cancelled' });
		return;
	}

	// ─── Stage 1: Signal-Weighted Lloyd's ──────────────────────────

	const positions: Position[] = [];

	// K-means++ init
	const firstIdx = interiorPixels[Math.floor(Math.random() * interiorPixels.length)]!;
	positions.push({
		id: aps[0]!.id,
		x: firstIdx % w,
		y: Math.floor(firstIdx / w),
		radius: aps[0]!.interferenceRadius
	});

	for (let k = 1; k < numAps; k++) {
		let bestDist = -1;
		let bestPx = interiorPixels[0]!;
		for (const px of interiorPixels) {
			const px_x = px % w;
			const px_y = Math.floor(px / w);
			let minD = Infinity;
			for (const p of positions) {
				const d = (px_x - p.x) ** 2 + (px_y - p.y) ** 2;
				if (d < minD) minD = d;
			}
			if (minD > bestDist) {
				bestDist = minD;
				bestPx = px;
			}
		}
		positions.push({
			id: aps[k]!.id,
			x: bestPx % w,
			y: Math.floor(bestPx / w),
			radius: aps[k]!.interferenceRadius
		});
	}

	// Lloyd's iterations
	for (let iter = 0; iter < 30; iter++) {
		if (cancelled) {
			self.postMessage({ type: 'cancelled' });
			return;
		}

		const buckets: Array<{ sumX: number; sumY: number; sumW: number }> = positions.map(() => ({
			sumX: 0,
			sumY: 0,
			sumW: 0
		}));

		for (let s = 0; s < samples.length; s++) {
			let bestAp = 0;
			let bestSignal = 0;
			for (let a = 0; a < numAps; a++) {
				const dx = samples[s]!.x - positions[a]!.x;
				const dy = samples[s]!.y - positions[a]!.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				let signal = signalStrengthOptimizer(dist, positions[a]!.radius);
				if (signal > 0.001) {
					const srcIdx = nearestSourceIdx(cache, positions[a]!.x, positions[a]!.y);
					if (srcIdx >= 0) {
						const dbLoss = cache.table[srcIdx * cache.numSamples + s]!;
						if (dbLoss > 0) signal *= Math.pow(10, -dbLoss / 20);
					}
				}
				if (signal > bestSignal) {
					bestSignal = signal;
					bestAp = a;
				}
			}
			// Fixed APs contribute signal but don't claim samples
			for (const fap of fixedAps) {
				const dx = samples[s]!.x - fap.x;
				const dy = samples[s]!.y - fap.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				let signal = signalStrengthOptimizer(dist, fap.interferenceRadius) * fap.signalScale;
				if (signal > 0.001) {
					const srcIdx = nearestSourceIdx(cache, fap.x, fap.y);
					if (srcIdx >= 0) {
						const dbLoss = cache.table[srcIdx * cache.numSamples + s]!;
						if (dbLoss > 0) signal *= Math.pow(10, -dbLoss / 20);
					}
				}
				if (signal > bestSignal) bestSignal = signal;
			}
			const deficit = 1.0 - bestSignal;
			// Density-proportional: conference room (0.8) pulls ~3x harder than stairwell (0.03)
			const densityW = sampleDensity[s] ?? baseline;
			const weight = (1 + deficit * 3) * densityW;
			buckets[bestAp]!.sumX += samples[s]!.x * weight;
			buckets[bestAp]!.sumY += samples[s]!.y * weight;
			buckets[bestAp]!.sumW += weight;
		}

		let maxMove = 0;
		for (let a = 0; a < numAps; a++) {
			const b = buckets[a]!;
			if (b.sumW === 0) continue;
			const nx = b.sumX / b.sumW;
			const ny = b.sumY / b.sumW;
			maxMove = Math.max(maxMove, Math.hypot(nx - positions[a]!.x, ny - positions[a]!.y));
			const snapped = snapToInterior(nx, ny, interiorPixels, w);
			positions[a]!.x = snapped.x;
			positions[a]!.y = snapped.y;
		}
		if (maxMove < 1.0) break;
	}

	const lloydsScore = evaluateCoverage(positions, samples, cache, fixedAps, sampleDensity);
	self.postMessage({
		type: 'progress',
		positions: positions.map((p) => ({ id: p.id, x: p.x, y: p.y })),
		score: lloydsScore,
		iteration: 20,
		totalIterations: 100,
		stage: "Lloyd's complete"
	});

	await yieldToEventLoop();
	if (cancelled) {
		self.postMessage({ type: 'cancelled' });
		return;
	}

	// ─── Stage 2: PSO Refinement ────────────────────────────────────

	const SWARM = 20;
	const PSO_ITERS = 60;
	const dim = numAps * 2;

	const pos = new Float32Array(SWARM * dim);
	const vel = new Float32Array(SWARM * dim);
	const pBest = new Float32Array(SWARM * dim);
	const pBestScore = new Float32Array(SWARM);
	const gBest = new Float32Array(dim);
	let gBestScore = -Infinity;

	for (let a = 0; a < numAps; a++) {
		pos[a * 2] = positions[a]!.x;
		pos[a * 2 + 1] = positions[a]!.y;
	}
	pBest.set(pos.subarray(0, dim));

	const jitterRadius = Math.max(w, h) * 0.2;
	for (let p = 1; p < SWARM; p++) {
		for (let a = 0; a < numAps; a++) {
			const bx = positions[a]!.x + (Math.random() - 0.5) * jitterRadius;
			const by = positions[a]!.y + (Math.random() - 0.5) * jitterRadius;
			const snapped = snapToInterior(bx, by, interiorPixels, w);
			pos[p * dim + a * 2] = snapped.x;
			pos[p * dim + a * 2 + 1] = snapped.y;
		}
		pBest.set(pos.subarray(p * dim, (p + 1) * dim), p * dim);
	}

	function evalParticle(pIdx: number): number {
		const tempPositions: Position[] = [];
		for (let a = 0; a < numAps; a++) {
			tempPositions.push({
				id: aps[a]!.id,
				x: pos[pIdx * dim + a * 2]!,
				y: pos[pIdx * dim + a * 2 + 1]!,
				radius: aps[a]!.interferenceRadius
			});
		}
		return evaluateCoverage(tempPositions, samples, cache, fixedAps, sampleDensity);
	}

	for (let p = 0; p < SWARM; p++) {
		pBestScore[p] = evalParticle(p);
		if (pBestScore[p]! > gBestScore) {
			gBestScore = pBestScore[p]!;
			gBest.set(pos.subarray(p * dim, (p + 1) * dim));
		}
	}

	for (let iter = 0; iter < PSO_ITERS; iter++) {
		// Yield every 5 iterations so cancel messages can arrive
		if (iter % 5 === 0) {
			await yieldToEventLoop();
			if (cancelled) {
				self.postMessage({ type: 'cancelled' });
				return;
			}
		}

		const inertia = 0.9 - 0.5 * (iter / PSO_ITERS);
		const c1 = 1.5;
		const c2 = 1.5;

		for (let p = 0; p < SWARM; p++) {
			for (let d = 0; d < dim; d++) {
				const r1 = Math.random();
				const r2 = Math.random();
				const off = p * dim + d;
				vel[off] =
					inertia * vel[off]! +
					c1 * r1 * (pBest[off]! - pos[off]!) +
					c2 * r2 * (gBest[d]! - pos[off]!);
				pos[off] = pos[off]! + vel[off]!;
			}
			for (let a = 0; a < numAps; a++) {
				const px = pos[p * dim + a * 2]!;
				const py = pos[p * dim + a * 2 + 1]!;
				const ix = Math.round(px);
				const iy = Math.round(py);
				if (ix < 0 || ix >= w || iy < 0 || iy >= h || !interior[iy * w + ix]) {
					const snapped = snapToInterior(px, py, interiorPixels, w);
					pos[p * dim + a * 2] = snapped.x;
					pos[p * dim + a * 2 + 1] = snapped.y;
				}
			}

			const score = evalParticle(p);
			if (score > pBestScore[p]!) {
				pBestScore[p] = score;
				pBest.set(pos.subarray(p * dim, (p + 1) * dim), p * dim);
				if (score > gBestScore) {
					gBestScore = score;
					gBest.set(pos.subarray(p * dim, (p + 1) * dim));
				}
			}
		}

		if (iter % 10 === 0) {
			const gPositions: Array<{ id: string; x: number; y: number }> = [];
			for (let a = 0; a < numAps; a++) {
				gPositions.push({ id: aps[a]!.id, x: gBest[a * 2]!, y: gBest[a * 2 + 1]! });
			}
			self.postMessage({
				type: 'progress',
				positions: gPositions,
				score: gBestScore,
				iteration: 20 + Math.round((iter / PSO_ITERS) * 60),
				totalIterations: 100,
				stage: 'PSO refining'
			});
		}
	}

	// ─── Stage 3: Coordinate Descent Polish ─────────────────────────

	await yieldToEventLoop();
	if (cancelled) {
		self.postMessage({ type: 'cancelled' });
		return;
	}

	const finalPositions: Position[] = [];
	for (let a = 0; a < numAps; a++) {
		finalPositions.push({
			id: aps[a]!.id,
			x: Math.round(gBest[a * 2]!),
			y: Math.round(gBest[a * 2 + 1]!),
			radius: aps[a]!.interferenceRadius
		});
	}

	const DIRS = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
		[1, 1],
		[-1, 1],
		[1, -1],
		[-1, -1]
	];
	let polishStep = 5;
	const minStep = 0.5;

	while (polishStep >= minStep) {
		await yieldToEventLoop();
		if (cancelled) {
			self.postMessage({ type: 'cancelled' });
			return;
		}
		let improved = false;
		let bestScore = evaluateExact(finalPositions, samples, mask, w, h, wallAttenuation, fixedAps);

		for (let a = 0; a < numAps; a++) {
			for (const [ddx, ddy] of DIRS) {
				const oldX = finalPositions[a]!.x;
				const oldY = finalPositions[a]!.y;
				const nx = Math.round(oldX + ddx! * polishStep);
				const ny = Math.round(oldY + ddy! * polishStep);
				if (nx < 0 || nx >= w || ny < 0 || ny >= h || !interior[ny * w + nx]) continue;
				finalPositions[a]!.x = nx;
				finalPositions[a]!.y = ny;
				const score = evaluateExact(finalPositions, samples, mask, w, h, wallAttenuation, fixedAps);
				if (score > bestScore) {
					bestScore = score;
					improved = true;
				} else {
					finalPositions[a]!.x = oldX;
					finalPositions[a]!.y = oldY;
				}
			}
		}
		if (!improved) polishStep *= 0.5;
	}

	const finalScore = evaluateExact(finalPositions, samples, mask, w, h, wallAttenuation, fixedAps);
	const initialScore = evaluateCoverage(
		aps.map((a) => ({ ...a, radius: a.interferenceRadius })),
		samples,
		cache,
		fixedAps,
		sampleDensity
	);
	const improvement = initialScore > 0 ? ((finalScore - initialScore) / initialScore) * 100 : 0;

	self.postMessage({
		type: 'result',
		positions: finalPositions.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y) })),
		score: finalScore,
		improvement
	});
}
