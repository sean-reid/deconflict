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
	boundary: Array<{ x: number; y: number }>;
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
	const {
		aps,
		wallMask: maskArr,
		maskWidth: w,
		maskHeight: h,
		wallAttenuation,
		iterations,
		boundary
	} = msg;
	const mask = new Uint8Array(maskArr);

	// Step 1: Compute interior using the building boundary polygon
	// A pixel is interior if it's inside the boundary polygon and not a wall
	const interior = new Uint8Array(w * h);
	if (boundary.length >= 3) {
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				if (!mask[y * w + x] && pointInPolygon(x, y, boundary)) {
					interior[y * w + x] = 1;
				}
			}
		}
	}

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

/** Ray-casting point-in-polygon test */
function pointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i]!.x,
			yi = polygon[i]!.y;
		const xj = polygon[j]!.x,
			yj = polygon[j]!.y;
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

// Kept for reference but no longer used - boundary polygon approach is more reliable
function _computeInterior(mask: Uint8Array, w: number, h: number): Uint8Array {
	// Downsample for the expensive morph close, then upsample the result
	const maxDim = 400;
	const rs = Math.min(1, maxDim / Math.max(w, h));
	const sw = Math.round(w * rs);
	const sh = Math.round(h * rs);

	// Downsample wall mask
	const small = new Uint8Array(sw * sh);
	for (let sy = 0; sy < sh; sy++) {
		const oy = Math.min(h - 1, Math.round(sy / rs));
		for (let sx = 0; sx < sw; sx++) {
			const ox = Math.min(w - 1, Math.round(sx / rs));
			small[sy * sw + sx] = mask[oy * w + ox]!;
		}
	}

	// Must be large enough to close door gaps (~10-15px at this resolution)
	// Erosion step restores wall thickness, so rooms aren't lost
	const dilateR = Math.max(10, Math.round(sw * 0.04));

	// Passable: 1 = can flood, 0 = wall
	const passable = new Uint8Array(sw * sh);
	for (let i = 0; i < sw * sh; i++) passable[i] = small[i] ? 0 : 1;

	// Dilate walls (shrink passable)
	const dilPass = new Uint8Array(passable);
	for (let y = 0; y < sh; y++) {
		for (let x = 0; x < sw; x++) {
			if (!small[y * sw + x]) continue;
			const ylo = Math.max(0, y - dilateR),
				yhi = Math.min(sh - 1, y + dilateR);
			const xlo = Math.max(0, x - dilateR),
				xhi = Math.min(sw - 1, x + dilateR);
			for (let ny = ylo; ny <= yhi; ny++) {
				for (let nx = xlo; nx <= xhi; nx++) {
					dilPass[ny * sw + nx] = 0;
				}
			}
		}
	}

	// Erode walls back (dilate passable)
	const closedPass = new Uint8Array(dilPass);
	for (let y = 0; y < sh; y++) {
		for (let x = 0; x < sw; x++) {
			if (dilPass[y * sw + x] !== 1) continue;
			const ylo = Math.max(0, y - dilateR),
				yhi = Math.min(sh - 1, y + dilateR);
			const xlo = Math.max(0, x - dilateR),
				xhi = Math.min(sw - 1, x + dilateR);
			for (let ny = ylo; ny <= yhi; ny++) {
				for (let nx = xlo; nx <= xhi; nx++) {
					closedPass[ny * sw + nx] = 1;
				}
			}
		}
	}

	// Flood fill exterior from border
	const exterior = new Uint8Array(sw * sh);
	const queue: number[] = [];
	for (let x = 0; x < sw; x++) {
		if (closedPass[x]) queue.push(x);
		if (closedPass[(sh - 1) * sw + x]) queue.push((sh - 1) * sw + x);
	}
	for (let y = 0; y < sh; y++) {
		if (closedPass[y * sw]) queue.push(y * sw);
		if (closedPass[y * sw + sw - 1]) queue.push(y * sw + sw - 1);
	}
	while (queue.length > 0) {
		const idx = queue.pop()!;
		if (exterior[idx]) continue;
		exterior[idx] = 1;
		const x = idx % sw,
			y = Math.floor(idx / sw);
		if (y > 0 && !exterior[idx - sw] && closedPass[idx - sw]) queue.push(idx - sw);
		if (y < sh - 1 && !exterior[idx + sw] && closedPass[idx + sw]) queue.push(idx + sw);
		if (x > 0 && !exterior[idx - 1] && closedPass[idx - 1]) queue.push(idx - 1);
		if (x < sw - 1 && !exterior[idx + 1] && closedPass[idx + 1]) queue.push(idx + 1);
	}

	// Small interior
	const smallInterior = new Uint8Array(sw * sh);
	for (let i = 0; i < sw * sh; i++) {
		if (!exterior[i] && !small[i]) smallInterior[i] = 1;
	}

	// Upsample to full resolution
	const interior = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) {
		const sy = Math.min(sh - 1, Math.round(y * rs));
		for (let x = 0; x < w; x++) {
			const sx = Math.min(sw - 1, Math.round(x * rs));
			// Interior at full res: upsampled interior AND not wall in original mask
			if (smallInterior[sy * sw + sx] && !mask[y * w + x]) {
				interior[y * w + x] = 1;
			}
		}
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
