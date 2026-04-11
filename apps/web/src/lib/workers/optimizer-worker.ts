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

	// Step 4: Incremental simulated annealing
	// Cache per-sample signal from each AP to avoid full recalculation every iteration.
	// When one AP moves, only recalculate that AP's contribution to each sample.
	const numAps = positions.length;
	const numSamples = samples.length;

	// signalGrid[sampleIdx * numAps + apIdx] = signal from AP apIdx at sample sampleIdx
	const signalGrid = new Float32Array(numSamples * numAps);
	const bestPerSample = new Float32Array(numSamples);

	function computeApSignals(apIdx: number): void {
		const ap = positions[apIdx]!;
		for (let s = 0; s < numSamples; s++) {
			const sample = samples[s]!;
			const dx = sample.x - ap.x;
			const dy = sample.y - ap.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			let signal = signalStrength(dist, ap.radius);
			if (signal > 0.001) {
				const crossings = countWallCrossings(mask, w, h, ap.x, ap.y, sample.x, sample.y);
				if (crossings > 0) {
					signal *= Math.pow(10, (-crossings * wallAttenuation) / 20);
				}
			}
			signalGrid[s * numAps + apIdx] = signal;
		}
	}

	function recomputeBest(): void {
		for (let s = 0; s < numSamples; s++) {
			let best = 0;
			for (let a = 0; a < numAps; a++) {
				const sig = signalGrid[s * numAps + a]!;
				if (sig > best) best = sig;
			}
			bestPerSample[s] = best;
		}
	}

	function totalScore(): number {
		let sum = 0;
		for (let s = 0; s < numSamples; s++) sum += bestPerSample[s]!;
		return sum / numSamples;
	}

	// Initialize signal grid for all APs
	for (let a = 0; a < numAps; a++) computeApSignals(a);
	recomputeBest();

	let currentScore = totalScore();
	const initialScore = currentScore;
	let bestScore = currentScore;
	let bestPositions = positions.map((p) => ({ id: p.id, x: p.x, y: p.y }));

	const T0 = 0.3;
	const Tmin = 0.001;
	const alpha = Math.pow(Tmin / T0, 1 / iterations);
	let temperature = T0;
	const maxMoveRadius = Math.max(w, h) * 0.15;

	// Temp buffer for rollback
	const savedSignals = new Float32Array(numSamples);
	const savedBest = new Float32Array(numSamples);

	for (let iter = 0; iter < iterations; iter++) {
		if (cancelled) {
			self.postMessage({ type: 'cancelled' });
			return;
		}

		const apIdx = Math.floor(Math.random() * numAps);
		const ap = positions[apIdx]!;
		const oldX = ap.x;
		const oldY = ap.y;

		const moveR = maxMoveRadius * Math.max(0.02, temperature / T0);
		const angle = Math.random() * 2 * Math.PI;
		const dist = Math.random() * moveR;
		const newX = Math.round(ap.x + Math.cos(angle) * dist);
		const newY = Math.round(ap.y + Math.sin(angle) * dist);

		if (newX < 0 || newX >= w || newY < 0 || newY >= h || !interior[newY * w + newX]) {
			temperature *= alpha;
			continue;
		}

		// Save old signals for this AP and old bestPerSample for rollback
		for (let s = 0; s < numSamples; s++) {
			savedSignals[s] = signalGrid[s * numAps + apIdx]!;
			savedBest[s] = bestPerSample[s]!;
		}

		// Move AP and recompute only its signals
		ap.x = newX;
		ap.y = newY;
		computeApSignals(apIdx);

		// Update bestPerSample incrementally
		for (let s = 0; s < numSamples; s++) {
			const newSig = signalGrid[s * numAps + apIdx]!;
			if (newSig > bestPerSample[s]!) {
				bestPerSample[s] = newSig;
			} else if (savedSignals[s]! >= bestPerSample[s]!) {
				// Old signal was the best - need to find new best
				let best = 0;
				for (let a = 0; a < numAps; a++) {
					const sig = signalGrid[s * numAps + a]!;
					if (sig > best) best = sig;
				}
				bestPerSample[s] = best;
			}
		}

		const newScore = totalScore();
		const delta = newScore - currentScore;

		if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
			currentScore = newScore;
			if (currentScore > bestScore) {
				bestScore = currentScore;
				bestPositions = positions.map((p) => ({ id: p.id, x: p.x, y: p.y }));
			}
		} else {
			// Rollback
			ap.x = oldX;
			ap.y = oldY;
			for (let s = 0; s < numSamples; s++) {
				signalGrid[s * numAps + apIdx] = savedSignals[s]!;
				bestPerSample[s] = savedBest[s]!;
			}
		}

		temperature *= alpha;

		if (iter % 1000 === 0) {
			self.postMessage({
				type: 'progress',
				positions: bestPositions,
				score: bestScore,
				iteration: iter,
				totalIterations: iterations
			});
		}
	}

	const improvement = initialScore > 0 ? ((bestScore - initialScore) / initialScore) * 100 : 0;
	self.postMessage({
		type: 'result',
		positions: bestPositions,
		score: bestScore,
		improvement
	});
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
