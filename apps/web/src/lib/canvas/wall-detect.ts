export interface DetectedWall {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	thickness: number;
}

/**
 * Detect walls from a floorplan image using threshold + skeletonization + line detection.
 * No external dependencies required.
 */
export function detectWalls(image: HTMLImageElement): DetectedWall[] {
	const maxDim = 500;
	const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
	const w = Math.round(image.naturalWidth * scale);
	const h = Math.round(image.naturalHeight * scale);

	// Step 1: Render to offscreen canvas at reduced size
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(image, 0, 0, w, h);

	const imageData = ctx.getImageData(0, 0, w, h);
	const { data } = imageData;

	// Step 2: Grayscale + threshold to binary (same approach as boundary-detect)
	const gray = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		gray[i] = Math.round((data[i * 4]! + data[i * 4 + 1]! + data[i * 4 + 2]!) / 3);
	}

	// Detect background brightness from edges
	let edgeSum = 0;
	let edgeCount = 0;
	for (let x = 0; x < w; x++) {
		edgeSum += gray[x]!;
		edgeSum += gray[(h - 1) * w + x]!;
		edgeCount += 2;
	}
	for (let y = 0; y < h; y++) {
		edgeSum += gray[y * w]!;
		edgeSum += gray[y * w + w - 1]!;
		edgeCount += 2;
	}
	const darkBg = edgeSum / edgeCount < 128;

	const threshold = darkBg ? 80 : 160;
	const binary = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		if (darkBg) {
			binary[i] = gray[i]! > threshold ? 1 : 0;
		} else {
			binary[i] = gray[i]! < threshold ? 1 : 0;
		}
	}

	// Step 3: Zhang-Suen thinning to skeletonize walls to 1px lines
	const skeleton = zhangSuenThin(binary, w, h);

	// Step 4: Trace continuous paths and approximate as line segments
	const minLength = 12;
	const allWalls = extractLineSegments(skeleton, w, h, minLength, scale);

	// Step 5: Filter out isolated segments (text, decorations)
	// Keep only walls that are near other walls (within proximity threshold)
	// Real building walls cluster together; text is isolated
	return filterConnectedWalls(allWalls, 30 / scale);
}

function zhangSuenThin(binary: Uint8Array, w: number, h: number): Uint8Array {
	// binary: 1 = foreground (wall), 0 = background
	const result = new Uint8Array(binary);
	let changed = true;

	while (changed) {
		changed = false;

		// Step 1
		const toRemove1: number[] = [];
		for (let y = 1; y < h - 1; y++) {
			for (let x = 1; x < w - 1; x++) {
				const idx = y * w + x;
				if (result[idx] !== 1) continue;

				// Get 8 neighbors (P2-P9 clockwise from top)
				const p2 = result[(y - 1) * w + x]!;
				const p3 = result[(y - 1) * w + x + 1]!;
				const p4 = result[y * w + x + 1]!;
				const p5 = result[(y + 1) * w + x + 1]!;
				const p6 = result[(y + 1) * w + x]!;
				const p7 = result[(y + 1) * w + x - 1]!;
				const p8 = result[y * w + x - 1]!;
				const p9 = result[(y - 1) * w + x - 1]!;

				const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
				if (B < 2 || B > 6) continue;

				// Count 0->1 transitions in clockwise order
				let A = 0;
				const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
				for (let i = 0; i < 8; i++) {
					if (seq[i] === 0 && seq[i + 1] === 1) A++;
				}
				if (A !== 1) continue;

				// Step 1 conditions
				if (p2 * p4 * p6 !== 0) continue;
				if (p4 * p6 * p8 !== 0) continue;

				toRemove1.push(idx);
			}
		}
		for (const idx of toRemove1) {
			result[idx] = 0;
			changed = true;
		}

		// Step 2 (same but different conditions)
		const toRemove2: number[] = [];
		for (let y = 1; y < h - 1; y++) {
			for (let x = 1; x < w - 1; x++) {
				const idx = y * w + x;
				if (result[idx] !== 1) continue;

				const p2 = result[(y - 1) * w + x]!;
				const p3 = result[(y - 1) * w + x + 1]!;
				const p4 = result[y * w + x + 1]!;
				const p5 = result[(y + 1) * w + x + 1]!;
				const p6 = result[(y + 1) * w + x]!;
				const p7 = result[(y + 1) * w + x - 1]!;
				const p8 = result[y * w + x - 1]!;
				const p9 = result[(y - 1) * w + x - 1]!;

				const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
				if (B < 2 || B > 6) continue;

				let A = 0;
				const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
				for (let i = 0; i < 8; i++) {
					if (seq[i] === 0 && seq[i + 1] === 1) A++;
				}
				if (A !== 1) continue;

				// Step 2 conditions (different from step 1)
				if (p2 * p4 * p8 !== 0) continue;
				if (p2 * p6 * p8 !== 0) continue;

				toRemove2.push(idx);
			}
		}
		for (const idx of toRemove2) {
			result[idx] = 0;
			changed = true;
		}
	}

	return result;
}

/**
 * Trace continuous paths along the skeleton, then approximate
 * each path as line segments using Douglas-Peucker simplification.
 * Handles curves, diagonals, and any wall shape.
 */
function extractLineSegments(
	skeleton: Uint8Array,
	w: number,
	h: number,
	minLength: number,
	scale: number
): DetectedWall[] {
	const visited = new Uint8Array(w * h);
	const paths: Array<Array<{ x: number; y: number }>> = [];

	// Find all connected paths in the skeleton
	for (let i = 0; i < w * h; i++) {
		if (!skeleton[i] || visited[i]) continue;

		// Find an endpoint or junction to start from
		const startX = i % w;
		const startY = Math.floor(i / w);

		// Trace from this pixel
		const path = tracePath(skeleton, visited, w, h, startX, startY);
		if (path.length >= minLength) {
			paths.push(path.map((p) => ({ x: p.x / scale, y: p.y / scale })));
		}
	}

	// Convert paths to line segments using Douglas-Peucker
	const walls: DetectedWall[] = [];
	for (const path of paths) {
		const simplified = douglasPeucker(path, 2 / scale);
		for (let i = 0; i < simplified.length - 1; i++) {
			const a = simplified[i]!;
			const b = simplified[i + 1]!;
			const len = Math.hypot(b.x - a.x, b.y - a.y);
			if (len >= minLength / scale) {
				walls.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, thickness: 3 });
			}
		}
	}

	return walls;
}

/** Trace a connected path through the skeleton from a starting pixel */
function tracePath(
	skeleton: Uint8Array,
	visited: Uint8Array,
	w: number,
	h: number,
	startX: number,
	startY: number
): Array<{ x: number; y: number }> {
	const path: Array<{ x: number; y: number }> = [];
	let cx = startX;
	let cy = startY;

	while (true) {
		const idx = cy * w + cx;
		if (visited[idx]) break;
		visited[idx] = 1;
		path.push({ x: cx, y: cy });

		// Find next unvisited neighbor (8-connected)
		let found = false;
		for (const [dx, dy] of [
			[1, 0],
			[0, 1],
			[-1, 0],
			[0, -1],
			[1, 1],
			[-1, 1],
			[1, -1],
			[-1, -1]
		]) {
			const nx = cx + dx;
			const ny = cy + dy;
			if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
				const ni = ny * w + nx;
				if (skeleton[ni] && !visited[ni]) {
					cx = nx;
					cy = ny;
					found = true;
					break;
				}
			}
		}
		if (!found) break;
	}

	return path;
}

function douglasPeucker(
	points: Array<{ x: number; y: number }>,
	epsilon: number
): Array<{ x: number; y: number }> {
	if (points.length <= 2) return points;

	let maxDist = 0;
	let maxIdx = 0;
	const first = points[0]!;
	const last = points[points.length - 1]!;

	for (let i = 1; i < points.length - 1; i++) {
		const p = points[i]!;
		const dx = last.x - first.x;
		const dy = last.y - first.y;
		const lenSq = dx * dx + dy * dy;
		let d: number;
		if (lenSq === 0) {
			d = Math.hypot(p.x - first.x, p.y - first.y);
		} else {
			const t = Math.max(0, Math.min(1, ((p.x - first.x) * dx + (p.y - first.y) * dy) / lenSq));
			d = Math.hypot(p.x - (first.x + t * dx), p.y - (first.y + t * dy));
		}
		if (d > maxDist) {
			maxDist = d;
			maxIdx = i;
		}
	}

	if (maxDist > epsilon) {
		const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
		const right = douglasPeucker(points.slice(maxIdx), epsilon);
		return [...left.slice(0, -1), ...right];
	}

	return [first, last];
}

/**
 * Filter out isolated wall segments that aren't part of the main building.
 * Real building walls connect to each other. Text, legends, and decorations
 * produce isolated segments that don't connect to anything.
 */
function filterConnectedWalls(walls: DetectedWall[], proximity: number): DetectedWall[] {
	if (walls.length <= 1) return walls;

	// Build adjacency: two walls are "connected" if any endpoint is within proximity
	const neighbors: number[][] = walls.map(() => []);
	for (let i = 0; i < walls.length; i++) {
		for (let j = i + 1; j < walls.length; j++) {
			if (wallsNear(walls[i]!, walls[j]!, proximity)) {
				neighbors[i]!.push(j);
				neighbors[j]!.push(i);
			}
		}
	}

	// Find connected components via BFS
	const componentId = new Int32Array(walls.length).fill(-1);
	const componentSizes: number[] = [];
	let nextId = 0;

	for (let i = 0; i < walls.length; i++) {
		if (componentId[i] !== -1) continue;
		const id = nextId++;
		let size = 0;
		const queue = [i];
		componentId[i] = id;
		while (queue.length > 0) {
			const idx = queue.pop()!;
			size++;
			for (const n of neighbors[idx]!) {
				if (componentId[n] === -1) {
					componentId[n] = id;
					queue.push(n);
				}
			}
		}
		componentSizes.push(size);
	}

	// Keep only the largest connected component
	let bestComp = 0;
	let bestSize = 0;
	for (let i = 0; i < componentSizes.length; i++) {
		if (componentSizes[i]! > bestSize) {
			bestSize = componentSizes[i]!;
			bestComp = i;
		}
	}

	return walls.filter((_, i) => componentId[i] === bestComp);
}

function wallsNear(a: DetectedWall, b: DetectedWall, proximity: number): boolean {
	const p2 = proximity * proximity;
	// Check all 4 endpoint-to-endpoint distances
	const pairs = [
		[a.x1, a.y1, b.x1, b.y1],
		[a.x1, a.y1, b.x2, b.y2],
		[a.x2, a.y2, b.x1, b.y1],
		[a.x2, a.y2, b.x2, b.y2]
	];
	for (const [ax, ay, bx, by] of pairs) {
		if ((ax! - bx!) * (ax! - bx!) + (ay! - by!) * (ay! - by!) <= p2) return true;
	}
	return false;
}
