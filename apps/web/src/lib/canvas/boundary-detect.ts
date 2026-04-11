export interface BoundaryResult {
	polygon: Array<{ x: number; y: number }>;
	areaPx: number; // area in image pixels squared
}

export function detectBoundary(image: HTMLImageElement): BoundaryResult | null {
	// 1. Draw image to an offscreen canvas at reduced size for performance
	const maxDim = 400;
	const scale = Math.min(1, maxDim / Math.max(image.naturalWidth, image.naturalHeight));
	const w = Math.round(image.naturalWidth * scale);
	const h = Math.round(image.naturalHeight * scale);

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(image, 0, 0, w, h);

	const imageData = ctx.getImageData(0, 0, w, h);
	const { data } = imageData;

	// 2. Convert to binary: pixels brighter than threshold = background (1), darker = building (0)
	//    Floorplans typically have dark lines on light background
	//    Auto-detect: if majority of edge pixels are dark, invert
	const binary = new Uint8Array(w * h);
	const threshold = 200; // brightness threshold

	for (let i = 0; i < w * h; i++) {
		const r = data[i * 4]!;
		const g = data[i * 4 + 1]!;
		const b = data[i * 4 + 2]!;
		const brightness = (r + g + b) / 3;
		binary[i] = brightness > threshold ? 1 : 0; // 1 = background, 0 = content
	}

	// Check if we need to invert (dark background floorplan)
	let edgeBright = 0;
	let edgeCount = 0;
	for (let x = 0; x < w; x++) {
		edgeBright += binary[x]!;
		edgeCount++;
		edgeBright += binary[(h - 1) * w + x]!;
		edgeCount++;
	}
	for (let y = 0; y < h; y++) {
		edgeBright += binary[y * w]!;
		edgeCount++;
		edgeBright += binary[y * w + w - 1]!;
		edgeCount++;
	}

	// If edges are mostly dark (content), invert so background = 1
	if (edgeBright / edgeCount < 0.5) {
		for (let i = 0; i < binary.length; i++) {
			binary[i] = binary[i] ? 0 : 1;
		}
	}

	// 3. Flood fill from corners to mark definite background
	const visited = new Uint8Array(w * h);
	const queue: number[] = [];

	// Seed from all border pixels that are background
	for (let x = 0; x < w; x++) {
		if (binary[x]) queue.push(x);
		if (binary[(h - 1) * w + x]) queue.push((h - 1) * w + x);
	}
	for (let y = 0; y < h; y++) {
		if (binary[y * w]) queue.push(y * w);
		if (binary[y * w + w - 1]) queue.push(y * w + w - 1);
	}

	// BFS flood fill
	while (queue.length > 0) {
		const idx = queue.pop()!;
		if (visited[idx]) continue;
		visited[idx] = 1;

		const x = idx % w;
		const y = Math.floor(idx / w);

		const neighbors = [
			y > 0 ? idx - w : -1,
			y < h - 1 ? idx + w : -1,
			x > 0 ? idx - 1 : -1,
			x < w - 1 ? idx + 1 : -1
		];

		for (const n of neighbors) {
			if (n >= 0 && !visited[n] && binary[n]) {
				queue.push(n);
			}
		}
	}

	// 4. Everything NOT visited by flood fill is inside the building
	// Create a mask: 1 = building interior, 0 = background
	const mask = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		mask[i] = visited[i] ? 0 : 1;
	}

	// 5. Find bounds and area of the building mask
	let startIdx = -1;
	for (let i = 0; i < w * h; i++) {
		if (mask[i]) {
			startIdx = i;
			break;
		}
	}

	if (startIdx === -1) return null; // no building found

	let areaPx = 0;
	let minX = w,
		maxX = 0,
		minY = h,
		maxY = 0;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (mask[y * w + x]) {
				areaPx++;
				if (x < minX) minX = x;
				if (x > maxX) maxX = x;
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
		}
	}

	// Scale area back to original image coordinates
	const areaOriginal = areaPx / (scale * scale);

	// 6. Extract a simplified boundary polygon by sampling the mask edges
	// Walk each row, find leftmost and rightmost building pixel
	const leftEdge: Array<{ x: number; y: number }> = [];
	const rightEdge: Array<{ x: number; y: number }> = [];

	for (let y = minY; y <= maxY; y += 2) {
		// sample every 2 rows for efficiency
		let lx = -1,
			rx = -1;
		for (let x = minX; x <= maxX; x++) {
			if (mask[y * w + x]) {
				lx = x;
				break;
			}
		}
		for (let x = maxX; x >= minX; x--) {
			if (mask[y * w + x]) {
				rx = x;
				break;
			}
		}
		if (lx >= 0) leftEdge.push({ x: lx / scale, y: y / scale });
		if (rx >= 0) rightEdge.push({ x: rx / scale, y: y / scale });
	}

	// Combine: left edge top-to-bottom, then right edge bottom-to-top
	rightEdge.reverse();
	const polygon = [...leftEdge, ...rightEdge];

	// Simplify polygon using Douglas-Peucker
	const simplified = douglasPeucker(polygon, 3 / scale);

	return {
		polygon: simplified,
		areaPx: areaOriginal
	};
}

// Douglas-Peucker line simplification
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
		const d = pointToLineDist(points[i]!, first, last);
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

function pointToLineDist(
	p: { x: number; y: number },
	a: { x: number; y: number },
	b: { x: number; y: number }
): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
	const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
	return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// Shoelace formula for polygon area
export function polygonArea(points: Array<{ x: number; y: number }>): number {
	let area = 0;
	const n = points.length;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		area += points[i]!.x * points[j]!.y;
		area -= points[j]!.x * points[i]!.y;
	}
	return Math.abs(area) / 2;
}
