/// <reference lib="webworker" />

import { computeBuildingInterior } from '../canvas/morph-interior.js';
import {
	signalStrengthOptimizer,
	countWallCrossings,
	buildAttenField,
	lookupAtten,
	type AttenField
} from '../rf/propagation.js';

interface ApInput {
	id: string;
	x: number;
	y: number;
	interferenceRadius: number;
}

interface OptimizeMessage {
	type: 'optimize';
	aps: ApInput[];
	wallMask: Uint8Array;
	maskWidth: number;
	maskHeight: number;
	wallAttenuation: number;
	iterations: number;
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

// ─── Evaluation helpers ─────────────────────────────────────────────

interface Position {
	id: string;
	x: number;
	y: number;
	radius: number;
}

/**
 * Evaluate coverage using precomputed attenuation fields (O(1) wall lookup).
 * Used by Lloyd's and PSO stages for fast iteration.
 */
function evaluateFast(
	positions: Position[],
	samples: Array<{ x: number; y: number }>,
	wallData: Uint8Array,
	wallW: number,
	wallH: number,
	wallAttenuation: number,
	attenFields: AttenField[]
): number {
	let total = 0;
	for (let s = 0; s < samples.length; s++) {
		let best = 0;
		for (let a = 0; a < positions.length; a++) {
			const dx = samples[s]!.x - positions[a]!.x;
			const dy = samples[s]!.y - positions[a]!.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			let signal = signalStrengthOptimizer(dist, positions[a]!.radius);
			if (signal > 0.001 && attenFields[a]) {
				const loss = lookupAtten(attenFields[a]!, samples[s]!.x, samples[s]!.y);
				if (loss > 0) signal *= Math.pow(10, -loss / 20);
			}
			if (signal > best) best = signal;
		}
		total += best;
	}
	return total / samples.length;
}

/**
 * Rebuild attenuation fields for all AP positions.
 * Each field is a coarse grid of dB attenuation from the AP.
 */
function buildFields(
	positions: Position[],
	wallData: Uint8Array,
	wallW: number,
	wallH: number,
	wallAttenuation: number
): AttenField[] {
	// Use flat dB per crossing: materialDb = [wallAttenuation], materialMap = null
	const matDb = [wallAttenuation];
	return positions.map((p) =>
		buildAttenField(p.x, p.y, p.radius * 1.5, wallData, wallW, wallH, null, matDb, wallAttenuation)
	);
}

/**
 * Exact evaluation using stride-1 ray march. Used for final polish only.
 */
function evaluateExact(
	positions: Position[],
	samples: Array<{ x: number; y: number }>,
	mask: Uint8Array,
	w: number,
	h: number,
	wallAttenuation: number
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

// ─── Main optimization pipeline ─────────────────────────────────────

async function runOptimization(msg: OptimizeMessage): Promise<void> {
	const { aps, wallMask: mask, maskWidth: w, maskHeight: h, wallAttenuation } = msg;

	// Compute interior
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

	// Sample points
	const sampleCount = Math.min(400, interiorPixels.length);
	const samples: Array<{ x: number; y: number }> = [];
	const step = interiorPixels.length / sampleCount;
	for (let i = 0; i < sampleCount; i++) {
		const idx = interiorPixels[Math.floor(i * step)]!;
		samples.push({ x: idx % w, y: Math.floor(idx / w) });
	}

	// Precompute attenuation fields
	self.postMessage({
		type: 'progress',
		positions: [],
		score: 0,
		iteration: 0,
		totalIterations: 100,
		stage: 'Precomputing...'
	});

	if (cancelled) {
		self.postMessage({ type: 'cancelled' });
		return;
	}

	// ─── Stage 1: Signal-Weighted Lloyd's ──────────────────────────

	const positions: Position[] = [];

	// K-means++ initialization
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

	// Lloyd's iterations with precomputed fields
	for (let iter = 0; iter < 30; iter++) {
		if (cancelled) {
			self.postMessage({ type: 'cancelled' });
			return;
		}

		const fields = buildFields(positions, mask, w, h, wallAttenuation);

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
				if (signal > 0.001 && fields[a]) {
					const loss = lookupAtten(fields[a]!, samples[s]!.x, samples[s]!.y);
					if (loss > 0) signal *= Math.pow(10, -loss / 20);
				}
				if (signal > bestSignal) {
					bestSignal = signal;
					bestAp = a;
				}
			}
			const deficit = 1.0 - bestSignal;
			const weight = 1 + deficit * 3;
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

	const lloydsFields = buildFields(positions, mask, w, h, wallAttenuation);
	const lloydsScore = evaluateFast(positions, samples, mask, w, h, wallAttenuation, lloydsFields);
	self.postMessage({
		type: 'progress',
		positions: positions.map((p) => ({ id: p.id, x: p.x, y: p.y })),
		score: lloydsScore,
		iteration: 20,
		totalIterations: 100,
		stage: "Lloyd's complete"
	});

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
		const fields = buildFields(tempPositions, mask, w, h, wallAttenuation);
		return evaluateFast(tempPositions, samples, mask, w, h, wallAttenuation, fields);
	}

	for (let p = 0; p < SWARM; p++) {
		pBestScore[p] = evalParticle(p);
		if (pBestScore[p]! > gBestScore) {
			gBestScore = pBestScore[p]!;
			gBest.set(pos.subarray(p * dim, (p + 1) * dim));
		}
	}

	for (let iter = 0; iter < PSO_ITERS; iter++) {
		if (cancelled) {
			self.postMessage({ type: 'cancelled' });
			return;
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
		if (cancelled) {
			self.postMessage({ type: 'cancelled' });
			return;
		}
		let improved = false;
		let bestScore = evaluateExact(finalPositions, samples, mask, w, h, wallAttenuation);

		for (let a = 0; a < numAps; a++) {
			if (cancelled) {
				self.postMessage({ type: 'cancelled' });
				return;
			}
			for (const [ddx, ddy] of DIRS) {
				const oldX = finalPositions[a]!.x;
				const oldY = finalPositions[a]!.y;
				const nx = Math.round(oldX + ddx! * polishStep);
				const ny = Math.round(oldY + ddy! * polishStep);
				if (nx < 0 || nx >= w || ny < 0 || ny >= h || !interior[ny * w + nx]) continue;
				finalPositions[a]!.x = nx;
				finalPositions[a]!.y = ny;
				const score = evaluateExact(finalPositions, samples, mask, w, h, wallAttenuation);
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

	const finalScore = evaluateExact(finalPositions, samples, mask, w, h, wallAttenuation);
	const initFields = buildFields(
		aps.map((a) => ({ ...a, radius: a.interferenceRadius })),
		mask,
		w,
		h,
		wallAttenuation
	);
	const initialScore = evaluateFast(
		aps.map((a) => ({ ...a, radius: a.interferenceRadius })),
		samples,
		mask,
		w,
		h,
		wallAttenuation,
		initFields
	);
	const improvement = initialScore > 0 ? ((finalScore - initialScore) / initialScore) * 100 : 0;

	self.postMessage({
		type: 'result',
		positions: finalPositions.map((p) => ({ id: p.id, x: Math.round(p.x), y: Math.round(p.y) })),
		score: finalScore,
		improvement
	});
}
