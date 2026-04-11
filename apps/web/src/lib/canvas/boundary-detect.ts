export interface BoundaryResult {
	polygon: Array<{ x: number; y: number }>;
	areaPx: number;
}

/**
 * For SVG URLs, strip text elements before rendering to avoid
 * text labels being detected as part of the building boundary.
 */
export async function prepareSvgForDetection(url: string): Promise<HTMLImageElement> {
	const img = new Image();

	// Try to fetch and clean SVG text
	try {
		const response = await fetch(url);
		const text = await response.text();

		if (text.trim().startsWith('<') && text.includes('<svg')) {
			const parser = new DOMParser();
			const doc = parser.parseFromString(text, 'image/svg+xml');
			const svg = doc.querySelector('svg');

			if (svg) {
				// Remove all text elements
				const textElements = svg.querySelectorAll('text, tspan');
				textElements.forEach((el) => el.remove());

				// Also remove small circles/dots that might be legend markers
				const circles = svg.querySelectorAll('circle');
				circles.forEach((el) => {
					const r = parseFloat(el.getAttribute('r') || '0');
					if (r < 5) el.remove();
				});

				const cleaned = new XMLSerializer().serializeToString(svg);
				const blob = new Blob([cleaned], { type: 'image/svg+xml' });
				const cleanUrl = URL.createObjectURL(blob);

				return new Promise((resolve, reject) => {
					img.onload = () => {
						URL.revokeObjectURL(cleanUrl);
						resolve(img);
					};
					img.onerror = reject;
					img.src = cleanUrl;
				});
			}
		}
	} catch {
		// Fall through to loading original
	}

	// Fallback: load original image
	return new Promise((resolve, reject) => {
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = url;
	});
}

export function detectBoundary(image: HTMLImageElement): BoundaryResult | null {
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

	// Step 1: Grayscale
	const gray = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		const r = data[i * 4]!;
		const g = data[i * 4 + 1]!;
		const b = data[i * 4 + 2]!;
		gray[i] = Math.round((r + g + b) / 3);
	}

	// Step 2: Detect background color from edges
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
	const edgeAvg = edgeSum / edgeCount;
	const darkBackground = edgeAvg < 128;

	// Step 3: Threshold - mark wall/content pixels as 0, background as 1
	const threshold = darkBackground ? 80 : 160;
	const binary = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		if (darkBackground) {
			binary[i] = gray[i]! > threshold ? 0 : 1;
		} else {
			binary[i] = gray[i]! < threshold ? 0 : 1;
		}
	}

	// Step 4: Find connected components of wall pixels (0)
	// Keep only the largest component to discard text, labels, legends
	const labels = new Int32Array(w * h);
	labels.fill(-1);
	const componentSizes: number[] = [];
	let nextLabel = 0;

	for (let i = 0; i < w * h; i++) {
		if (binary[i] === 0 && labels[i] === -1) {
			// BFS to label this component
			const label = nextLabel++;
			let size = 0;
			const queue = [i];
			labels[i] = label;

			while (queue.length > 0) {
				const idx = queue.pop()!;
				size++;
				const x = idx % w;
				const y = Math.floor(idx / w);

				const neighbors = [
					y > 0 ? idx - w : -1,
					y < h - 1 ? idx + w : -1,
					x > 0 ? idx - 1 : -1,
					x < w - 1 ? idx + 1 : -1
				];

				for (const n of neighbors) {
					if (n >= 0 && binary[n] === 0 && labels[n] === -1) {
						labels[n] = label;
						queue.push(n);
					}
				}
			}

			componentSizes.push(size);
		}
	}

	if (componentSizes.length === 0) return null;

	// Find the largest component
	let largestLabel = 0;
	let largestSize = 0;
	for (let i = 0; i < componentSizes.length; i++) {
		if (componentSizes[i]! > largestSize) {
			largestSize = componentSizes[i]!;
			largestLabel = i;
		}
	}

	// Step 5: Create cleaned binary - only keep largest component as walls
	const cleaned = new Uint8Array(w * h);
	cleaned.fill(1); // all background
	for (let i = 0; i < w * h; i++) {
		if (labels[i] === largestLabel) {
			cleaned[i] = 0; // wall
		}
	}

	// Step 6: Flood fill from border to find exterior
	const visited = new Uint8Array(w * h);
	const floodQueue: number[] = [];

	for (let x = 0; x < w; x++) {
		if (cleaned[x]) floodQueue.push(x);
		if (cleaned[(h - 1) * w + x]) floodQueue.push((h - 1) * w + x);
	}
	for (let y = 0; y < h; y++) {
		if (cleaned[y * w]) floodQueue.push(y * w);
		if (cleaned[y * w + w - 1]) floodQueue.push(y * w + w - 1);
	}

	while (floodQueue.length > 0) {
		const idx = floodQueue.pop()!;
		if (visited[idx]) continue;
		visited[idx] = 1;

		const x = idx % w;
		const y = Math.floor(idx / w);

		if (y > 0 && !visited[idx - w] && cleaned[idx - w]) floodQueue.push(idx - w);
		if (y < h - 1 && !visited[idx + w] && cleaned[idx + w]) floodQueue.push(idx + w);
		if (x > 0 && !visited[idx - 1] && cleaned[idx - 1]) floodQueue.push(idx - 1);
		if (x < w - 1 && !visited[idx + 1] && cleaned[idx + 1]) floodQueue.push(idx + 1);
	}

	// Step 7: Everything NOT visited (not reachable from border) is inside the building
	const mask = new Uint8Array(w * h);
	let areaPx = 0;
	let minX = w;
	let maxX = 0;
	let minY = h;
	let maxY = 0;

	for (let i = 0; i < w * h; i++) {
		if (!visited[i]) {
			mask[i] = 1;
			areaPx++;
			const x = i % w;
			const y = Math.floor(i / w);
			if (x < minX) minX = x;
			if (x > maxX) maxX = x;
			if (y < minY) minY = y;
			if (y > maxY) maxY = y;
		}
	}

	if (areaPx < 100) return null;

	const areaOriginal = areaPx / (scale * scale);

	// Step 8: Trace boundary polygon
	const leftEdge: Array<{ x: number; y: number }> = [];
	const rightEdge: Array<{ x: number; y: number }> = [];

	const step = Math.max(1, Math.round(2 / scale));
	for (let y = minY; y <= maxY; y += step) {
		let lx = -1;
		let rx = -1;
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

	rightEdge.reverse();
	const polygon = [...leftEdge, ...rightEdge];
	const simplified = douglasPeucker(polygon, 5 / scale);

	return { polygon: simplified, areaPx: areaOriginal };
}

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
