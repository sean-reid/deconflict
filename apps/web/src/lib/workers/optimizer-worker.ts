/// <reference lib="webworker" />

interface ApInput {
	id: string;
	x: number;
	y: number;
	interferenceRadius: number;
}

interface OptimizeMessage {
	type: 'optimize';
	aps: ApInput[];
	wallMask: number[];
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
		runOptimization(msg);
	}
};

function runOptimization(msg: OptimizeMessage): void {
	const { aps, wallMask: maskArr, maskWidth: w, maskHeight: h, wallAttenuation, iterations } = msg;
	const mask = new Uint8Array(maskArr);

	// Step 1: Compute interior mask (non-wall, non-exterior pixels inside building)
	const interior = computeInterior(mask, w, h);

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

	// Step 3: Initialize positions
	const positions = aps.map((a) => ({ id: a.id, x: a.x, y: a.y, radius: a.interferenceRadius }));

	// Evaluate initial score
	let currentScore = evaluateCoverage(positions, samples, mask, w, h, wallAttenuation);
	const initialScore = currentScore;

	// Step 4: Simulated annealing
	const T0 = 0.3;
	const Tmin = 0.001;
	const alpha = Math.pow(Tmin / T0, 1 / iterations);
	let temperature = T0;

	// Move radius: start at ~10% of mask dimension, shrink with temperature
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

		// Propose a move (scaled by temperature for adaptive step size)
		const moveR = maxMoveRadius * (temperature / T0);
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
			// Accept move
			currentScore = newScore;
		} else {
			// Reject move
			ap.x = oldX;
			ap.y = oldY;
		}

		temperature *= alpha;

		// Send progress every 500 iterations
		if (iter % 500 === 0) {
			self.postMessage({
				type: 'progress',
				positions: positions.map((p) => ({ id: p.id, x: p.x, y: p.y })),
				score: currentScore,
				iteration: iter,
				totalIterations: iterations
			});
		}
	}

	// Send final result
	const improvement = initialScore > 0 ? ((currentScore - initialScore) / initialScore) * 100 : 0;
	self.postMessage({
		type: 'result',
		positions: positions.map((p) => ({ id: p.id, x: p.x, y: p.y })),
		score: currentScore,
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
	if (ratio >= 3) return 0;
	return Math.pow(1 - ratio / 3, 2);
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

function computeInterior(mask: Uint8Array, w: number, h: number): Uint8Array {
	// Morphological close to seal door gaps, then flood fill to find exterior
	const dilateR = Math.max(5, Math.round(Math.max(w, h) * 0.02));

	// Passable map: 1 = passable, 0 = wall
	const passable = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) passable[i] = mask[i] ? 0 : 1;

	// Dilate walls (shrink passable)
	const dilPass = new Uint8Array(passable);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (!mask[y * w + x]) continue;
			const ylo = Math.max(0, y - dilateR),
				yhi = Math.min(h - 1, y + dilateR);
			const xlo = Math.max(0, x - dilateR),
				xhi = Math.min(w - 1, x + dilateR);
			for (let ny = ylo; ny <= yhi; ny++) {
				for (let nx = xlo; nx <= xhi; nx++) {
					dilPass[ny * w + nx] = 0;
				}
			}
		}
	}

	// Erode walls back (dilate passable)
	const closedPass = new Uint8Array(dilPass);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (dilPass[y * w + x] !== 1) continue;
			const ylo = Math.max(0, y - dilateR),
				yhi = Math.min(h - 1, y + dilateR);
			const xlo = Math.max(0, x - dilateR),
				xhi = Math.min(w - 1, x + dilateR);
			for (let ny = ylo; ny <= yhi; ny++) {
				for (let nx = xlo; nx <= xhi; nx++) {
					closedPass[ny * w + nx] = 1;
				}
			}
		}
	}

	// Flood fill exterior from border
	const exterior = new Uint8Array(w * h);
	const queue: number[] = [];
	for (let x = 0; x < w; x++) {
		if (closedPass[x]) queue.push(x);
		if (closedPass[(h - 1) * w + x]) queue.push((h - 1) * w + x);
	}
	for (let y = 0; y < h; y++) {
		if (closedPass[y * w]) queue.push(y * w);
		if (closedPass[y * w + w - 1]) queue.push(y * w + w - 1);
	}
	while (queue.length > 0) {
		const idx = queue.pop()!;
		if (exterior[idx]) continue;
		exterior[idx] = 1;
		const x = idx % w,
			y = Math.floor(idx / w);
		if (y > 0 && !exterior[idx - w] && closedPass[idx - w]) queue.push(idx - w);
		if (y < h - 1 && !exterior[idx + w] && closedPass[idx + w]) queue.push(idx + w);
		if (x > 0 && !exterior[idx - 1] && closedPass[idx - 1]) queue.push(idx - 1);
		if (x < w - 1 && !exterior[idx + 1] && closedPass[idx + 1]) queue.push(idx + 1);
	}

	// Interior = not exterior AND not wall
	const interior = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		if (!exterior[i] && !mask[i]) interior[i] = 1;
	}
	return interior;
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
