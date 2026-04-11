/// <reference lib="webworker" />

import { computeBuildingInterior } from '../canvas/morph-interior.js';

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

async function runOptimization(msg: OptimizeMessage): Promise<void> {
	const { aps, wallMask: mask, maskWidth: w, maskHeight: h, wallAttenuation, iterations } = msg;

	// Step 1: Compute interior via morph close + flood fill.
	// Handles L-shapes correctly. Downsampled for performance.
	const { interior } = computeBuildingInterior(mask, w, h, {
		maxDim: 200,
		dilateRatio: 0.04,
		minDilateR: 4
	});

	// Collect interior pixel indices for sampling and position constraints
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

	// Step 2: Sample coverage evaluation points from interior
	const sampleCount = Math.min(400, interiorPixels.length);
	const sampleIndices = sampleUniform(interiorPixels, sampleCount);
	const samples = sampleIndices.map((idx) => ({ x: idx % w, y: Math.floor(idx / w) }));

	// Step 3: Initialize positions and snap to interior if needed
	const positions = aps.map((a) => ({ id: a.id, x: a.x, y: a.y, radius: a.interferenceRadius }));

	for (const ap of positions) {
		const ix = Math.round(ap.x);
		const iy = Math.round(ap.y);
		if (ix < 0 || ix >= w || iy < 0 || iy >= h || !interior[iy * w + ix]) {
			let bestDist = Infinity;
			let bestIdx = interiorPixels[0]!;
			for (const px of interiorPixels) {
				const d = ((px % w) - ap.x) ** 2 + (Math.floor(px / w) - ap.y) ** 2;
				if (d < bestDist) {
					bestDist = d;
					bestIdx = px;
				}
			}
			ap.x = bestIdx % w;
			ap.y = Math.floor(bestIdx / w);
		}
	}

	// Evaluate initial score
	let currentScore = evaluateCoverage(positions, samples, mask, w, h, wallAttenuation);
	const initialScore = currentScore;

	// Track the best configuration found (never return worse than this)
	let bestScore = currentScore;
	let bestPositions = positions.map((p) => ({ id: p.id, x: p.x, y: p.y }));

	// Step 4: Simulated annealing
	const T0 = 0.3;
	const Tmin = 0.001;
	const alpha = Math.pow(Tmin / T0, 1 / iterations);
	let temperature = T0;

	// Move radius proportional to building size
	const maxMoveRadius = Math.max(w, h) * 0.15;

	for (let iter = 0; iter < iterations; iter++) {
		if (cancelled) {
			self.postMessage({ type: 'cancelled' });
			return;
		}

		// Pick a random AP
		const apIdx = Math.floor(Math.random() * positions.length);
		const ap = positions[apIdx]!;
		const oldX = ap.x;
		const oldY = ap.y;

		// Propose a move (large early, fine-tuned late)
		const moveR = maxMoveRadius * Math.max(0.02, temperature / T0);
		const angle = Math.random() * 2 * Math.PI;
		const dist = Math.random() * moveR;
		const newX = Math.round(ap.x + Math.cos(angle) * dist);
		const newY = Math.round(ap.y + Math.sin(angle) * dist);

		// Reject if outside interior
		if (newX < 0 || newX >= w || newY < 0 || newY >= h || !interior[newY * w + newX]) {
			temperature *= alpha;
			continue;
		}

		// Apply move and evaluate
		ap.x = newX;
		ap.y = newY;
		const newScore = evaluateCoverage(positions, samples, mask, w, h, wallAttenuation);

		const delta = newScore - currentScore;
		if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
			currentScore = newScore;
			// Update best if improved
			if (currentScore > bestScore) {
				bestScore = currentScore;
				bestPositions = positions.map((p) => ({ id: p.id, x: p.x, y: p.y }));
			}
		} else {
			ap.x = oldX;
			ap.y = oldY;
		}

		temperature *= alpha;

		// Send progress every 500 iterations
		if (iter % 500 === 0) {
			self.postMessage({
				type: 'progress',
				positions: bestPositions,
				score: bestScore,
				iteration: iter,
				totalIterations: iterations
			});
		}
	}

	// Always return the best configuration found, never worse than initial
	const improvement = initialScore > 0 ? ((bestScore - initialScore) / initialScore) * 100 : 0;
	self.postMessage({
		type: 'result',
		positions: bestPositions,
		score: bestScore,
		improvement
	});
}

function evaluateCoverage(
	aps: Array<{ x: number; y: number; radius: number }>,
	samples: Array<{ x: number; y: number }>,
	mask: Uint8Array,
	w: number,
	h: number,
	wallAttenuation: number
): number {
	let totalSignal = 0;
	for (const sample of samples) {
		let bestSignal = 0;
		for (const ap of aps) {
			const dx = sample.x - ap.x;
			const dy = sample.y - ap.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			// Use tighter falloff: signal within 1x radius, not 3x
			let signal = signalStrength(dist, ap.radius);
			if (signal > 0.001) {
				const crossings = countWallCrossings(mask, w, h, ap.x, ap.y, sample.x, sample.y);
				if (crossings > 0) {
					signal *= Math.pow(10, (-crossings * wallAttenuation) / 20);
				}
			}
			if (signal > bestSignal) bestSignal = signal;
		}
		totalSignal += bestSignal;
	}
	return totalSignal / samples.length;
}

function signalStrength(distance: number, radius: number): number {
	if (distance <= 0) return 1;
	const ratio = distance / radius;
	// Tighter than the heatmap model (1.5x radius max instead of 3x)
	// to strongly incentivize spreading APs across the building
	if (ratio >= 1.5) return 0;
	return Math.pow(1 - ratio / 1.5, 2);
}

function countWallCrossings(
	mask: Uint8Array,
	w: number,
	h: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number
): number {
	let ix = Math.round(x0),
		iy = Math.round(y0);
	const ex = Math.round(x1),
		ey = Math.round(y1);
	const dx = Math.abs(ex - ix);
	const dy = Math.abs(ey - iy);
	const sx = ix < ex ? 1 : -1;
	const sy = iy < ey ? 1 : -1;
	let err = dx - dy;
	let crossings = 0;
	let wasWall = false;

	while (true) {
		if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
			const isWall = mask[iy * w + ix] === 1;
			if (isWall && !wasWall) crossings++;
			wasWall = isWall;
		} else {
			wasWall = false;
		}
		if (ix === ex && iy === ey) break;
		const e2 = 2 * err;
		if (e2 > -dy) {
			err -= dy;
			ix += sx;
		}
		if (e2 < dx) {
			err += dx;
			iy += sy;
		}
	}
	return crossings;
}

function sampleUniform(arr: number[], count: number): number[] {
	if (count >= arr.length) return arr.slice();
	const result: number[] = [];
	const step = arr.length / count;
	for (let i = 0; i < count; i++) {
		result.push(arr[Math.floor(i * step)]!);
	}
	return result;
}
