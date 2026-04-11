export interface BoundaryResult {
	polygon: Array<{ x: number; y: number }>;
	areaPx: number;
}

/**
 * Strip text elements from SVG before rendering for cleaner detection.
 */
export async function prepareSvgForDetection(url: string): Promise<HTMLImageElement> {
	const img = new Image();

	try {
		const response = await fetch(url);
		const text = await response.text();

		if (text.trim().startsWith('<') && text.includes('<svg')) {
			const parser = new DOMParser();
			const doc = parser.parseFromString(text, 'image/svg+xml');
			const svg = doc.querySelector('svg');

			if (svg) {
				// Remove text, tspan, and small decorative elements
				svg.querySelectorAll('text, tspan').forEach((el) => el.remove());
				svg.querySelectorAll('circle').forEach((el) => {
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
		// Fall through
	}

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
		gray[i] = Math.round((data[i * 4]! + data[i * 4 + 1]! + data[i * 4 + 2]!) / 3);
	}

	// Step 2: Detect background from edges
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

	// Step 3: Binary threshold (1 = passable/background, 0 = wall)
	const threshold = darkBg ? 80 : 160;
	const binary = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		if (darkBg) {
			binary[i] = gray[i]! > threshold ? 0 : 1;
		} else {
			binary[i] = gray[i]! < threshold ? 0 : 1;
		}
	}

	// Step 4: Flood fill from border to mark exterior
	const exterior = new Uint8Array(w * h);
	const queue: number[] = [];

	for (let x = 0; x < w; x++) {
		if (binary[x]) queue.push(x);
		if (binary[(h - 1) * w + x]) queue.push((h - 1) * w + x);
	}
	for (let y = 0; y < h; y++) {
		if (binary[y * w]) queue.push(y * w);
		if (binary[y * w + w - 1]) queue.push(y * w + w - 1);
	}

	while (queue.length > 0) {
		const idx = queue.pop()!;
		if (exterior[idx]) continue;
		exterior[idx] = 1;
		const x = idx % w;
		const y = Math.floor(idx / w);
		if (y > 0 && !exterior[idx - w] && binary[idx - w]) queue.push(idx - w);
		if (y < h - 1 && !exterior[idx + w] && binary[idx + w]) queue.push(idx + w);
		if (x > 0 && !exterior[idx - 1] && binary[idx - 1]) queue.push(idx - 1);
		if (x < w - 1 && !exterior[idx + 1] && binary[idx + 1]) queue.push(idx + 1);
	}

	// Step 5: Interior = not exterior AND not wall
	// Mark interior regions, then find connected interior blobs
	const interior = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		if (!exterior[i] && binary[i]) {
			interior[i] = 1; // passable space inside walls
		}
	}

	// Step 6: Find connected interior blobs
	const blobLabels = new Int32Array(w * h);
	blobLabels.fill(-1);
	const blobSizes: number[] = [];
	const blobBounds: Array<{ minX: number; minY: number; maxX: number; maxY: number }> = [];
	let nextBlob = 0;

	for (let i = 0; i < w * h; i++) {
		if (interior[i] && blobLabels[i] === -1) {
			const label = nextBlob++;
			let size = 0;
			const bounds = { minX: w, minY: h, maxX: 0, maxY: 0 };
			const bq = [i];
			blobLabels[i] = label;

			while (bq.length > 0) {
				const idx = bq.pop()!;
				size++;
				const x = idx % w;
				const y = Math.floor(idx / w);
				if (x < bounds.minX) bounds.minX = x;
				if (x > bounds.maxX) bounds.maxX = x;
				if (y < bounds.minY) bounds.minY = y;
				if (y > bounds.maxY) bounds.maxY = y;

				const ns = [
					y > 0 ? idx - w : -1,
					y < h - 1 ? idx + w : -1,
					x > 0 ? idx - 1 : -1,
					x < w - 1 ? idx + 1 : -1
				];
				for (const n of ns) {
					if (n >= 0 && interior[n] && blobLabels[n] === -1) {
						blobLabels[n] = label;
						bq.push(n);
					}
				}
			}

			blobSizes.push(size);
			blobBounds.push(bounds);
		}
	}

	if (blobSizes.length === 0) return null;

	// Step 7: The building interior is the largest blob
	// But also include smaller blobs that are INSIDE the bounding box
	// of the largest blob (these are rooms separated by walls)
	let mainBlob = 0;
	let mainSize = 0;
	for (let i = 0; i < blobSizes.length; i++) {
		if (blobSizes[i]! > mainSize) {
			mainSize = blobSizes[i]!;
			mainBlob = i;
		}
	}

	const mainBounds = blobBounds[mainBlob]!;

	// Include all blobs whose center falls within the main blob's bounding box
	// (these are rooms inside the building separated by interior walls)
	const buildingMask = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		if (blobLabels[i] === mainBlob) {
			buildingMask[i] = 1;
		} else if (blobLabels[i] >= 0) {
			const blob = blobLabels[i]!;
			const b = blobBounds[blob]!;
			const cx = (b.minX + b.maxX) / 2;
			const cy = (b.minY + b.maxY) / 2;
			// Is this blob's center inside the main building bounds?
			if (
				cx >= mainBounds.minX &&
				cx <= mainBounds.maxX &&
				cy >= mainBounds.minY &&
				cy <= mainBounds.maxY
			) {
				buildingMask[i] = 1;
			}
		}
	}

	// Also include wall pixels that are inside the main bounds
	// (interior walls are part of the building footprint)
	for (let i = 0; i < w * h; i++) {
		if (binary[i] === 0 && !exterior[i]) {
			// Wall pixel, not exterior
			const x = i % w;
			const y = Math.floor(i / w);
			if (
				x >= mainBounds.minX &&
				x <= mainBounds.maxX &&
				y >= mainBounds.minY &&
				y <= mainBounds.maxY
			) {
				buildingMask[i] = 1;
			}
		}
	}

	// Step 8: Compute area and trace boundary
	let areaPx = 0;
	let minX = w;
	let maxX = 0;
	let minY = h;
	let maxY = 0;

	for (let i = 0; i < w * h; i++) {
		if (buildingMask[i]) {
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

	// Trace boundary
	const leftEdge: Array<{ x: number; y: number }> = [];
	const rightEdge: Array<{ x: number; y: number }> = [];

	const step = Math.max(1, Math.round(2 / scale));
	for (let y = minY; y <= maxY; y += step) {
		let lx = -1;
		let rx = -1;
		for (let x = minX; x <= maxX; x++) {
			if (buildingMask[y * w + x]) {
				lx = x;
				break;
			}
		}
		for (let x = maxX; x >= minX; x--) {
			if (buildingMask[y * w + x]) {
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
