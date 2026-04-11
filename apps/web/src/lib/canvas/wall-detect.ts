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

	// Step 4: Scan for horizontal and vertical runs on the skeleton
	const minLength = 15;
	const rawWalls = extractLineSegments(skeleton, w, h, minLength, scale);

	// Step 5: Merge nearby parallel segments
	const merged = mergeNearbySegments(rawWalls, 5 / scale);

	// Step 6: Recover thickness by measuring perpendicular extent in binary image
	for (const wall of merged) {
		wall.thickness = measureThickness(binary, wall, w, h, scale);
	}

	return merged;
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

function extractLineSegments(
	skeleton: Uint8Array,
	w: number,
	h: number,
	minLength: number,
	scale: number
): DetectedWall[] {
	const walls: DetectedWall[] = [];

	// Scan rows for horizontal runs
	for (let y = 0; y < h; y++) {
		let runStart = -1;
		for (let x = 0; x <= w; x++) {
			const pixel = x < w ? skeleton[y * w + x] : 0;
			if (pixel && runStart === -1) {
				runStart = x;
			} else if (!pixel && runStart !== -1) {
				const runLen = x - runStart;
				if (runLen >= minLength) {
					walls.push({
						x1: runStart / scale,
						y1: y / scale,
						x2: x / scale,
						y2: y / scale,
						thickness: 3
					});
				}
				runStart = -1;
			}
		}
	}

	// Scan columns for vertical runs
	for (let x = 0; x < w; x++) {
		let runStart = -1;
		for (let y = 0; y <= h; y++) {
			const pixel = y < h ? skeleton[y * w + x] : 0;
			if (pixel && runStart === -1) {
				runStart = y;
			} else if (!pixel && runStart !== -1) {
				const runLen = y - runStart;
				if (runLen >= minLength) {
					walls.push({
						x1: x / scale,
						y1: runStart / scale,
						x2: x / scale,
						y2: y / scale,
						thickness: 3
					});
				}
				runStart = -1;
			}
		}
	}

	return walls;
}

function mergeNearbySegments(walls: DetectedWall[], maxGap: number): DetectedWall[] {
	const merged: DetectedWall[] = [];
	const used = new Set<number>();

	for (let i = 0; i < walls.length; i++) {
		if (used.has(i)) continue;
		const wall = walls[i]!;
		const isHorizontal = wall.y1 === wall.y2;

		let bestX1 = wall.x1;
		let bestY1 = wall.y1;
		let bestX2 = wall.x2;
		let bestY2 = wall.y2;

		used.add(i);

		// Find nearby parallel segments to merge
		for (let j = i + 1; j < walls.length; j++) {
			if (used.has(j)) continue;
			const other = walls[j]!;
			const otherHorizontal = other.y1 === other.y2;

			if (isHorizontal !== otherHorizontal) continue;

			if (isHorizontal) {
				// Both horizontal - check if they are close in Y and overlapping in X
				const yDist = Math.abs(bestY1 - other.y1);
				if (yDist > maxGap) continue;

				const overlapX = Math.min(bestX2, other.x2) - Math.max(bestX1, other.x1);
				if (overlapX >= -maxGap) {
					bestX1 = Math.min(bestX1, other.x1);
					bestX2 = Math.max(bestX2, other.x2);
					bestY1 = (bestY1 + other.y1) / 2;
					bestY2 = bestY1;
					used.add(j);
				}
			} else {
				// Both vertical - check if they are close in X and overlapping in Y
				const xDist = Math.abs(bestX1 - other.x1);
				if (xDist > maxGap) continue;

				const overlapY = Math.min(bestY2, other.y2) - Math.max(bestY1, other.y1);
				if (overlapY >= -maxGap) {
					bestY1 = Math.min(bestY1, other.y1);
					bestY2 = Math.max(bestY2, other.y2);
					bestX1 = (bestX1 + other.x1) / 2;
					bestX2 = bestX1;
					used.add(j);
				}
			}
		}

		merged.push({
			x1: bestX1,
			y1: bestY1,
			x2: bestX2,
			y2: bestY2,
			thickness: wall.thickness
		});
	}

	return merged;
}

function measureThickness(
	binary: Uint8Array,
	wall: DetectedWall,
	w: number,
	h: number,
	scale: number
): number {
	const isHorizontal = wall.y1 === wall.y2;
	let totalThickness = 0;
	let samples = 0;

	if (isHorizontal) {
		// Sample along the wall, measure vertical extent
		const y = Math.round(wall.y1 * scale);
		const x1 = Math.round(wall.x1 * scale);
		const x2 = Math.round(wall.x2 * scale);
		const step = Math.max(1, Math.round((x2 - x1) / 10));

		for (let x = x1; x <= x2; x += step) {
			if (x < 0 || x >= w) continue;
			let up = 0;
			let down = 0;

			// Measure upward
			for (let dy = 0; dy < 50 && y - dy >= 0; dy++) {
				if (binary[(y - dy) * w + x]) {
					up = dy;
				} else {
					break;
				}
			}
			// Measure downward
			for (let dy = 0; dy < 50 && y + dy < h; dy++) {
				if (binary[(y + dy) * w + x]) {
					down = dy;
				} else {
					break;
				}
			}

			totalThickness += up + down + 1;
			samples++;
		}
	} else {
		// Vertical wall - sample along the wall, measure horizontal extent
		const x = Math.round(wall.x1 * scale);
		const y1 = Math.round(wall.y1 * scale);
		const y2 = Math.round(wall.y2 * scale);
		const step = Math.max(1, Math.round((y2 - y1) / 10));

		for (let y = y1; y <= y2; y += step) {
			if (y < 0 || y >= h) continue;
			let left = 0;
			let right = 0;

			for (let dx = 0; dx < 50 && x - dx >= 0; dx++) {
				if (binary[y * w + (x - dx)]) {
					left = dx;
				} else {
					break;
				}
			}
			for (let dx = 0; dx < 50 && x + dx < w; dx++) {
				if (binary[y * w + (x + dx)]) {
					right = dx;
				} else {
					break;
				}
			}

			totalThickness += left + right + 1;
			samples++;
		}
	}

	if (samples === 0) return 3;
	const avgThicknessScaled = totalThickness / samples;
	return Math.max(2, Math.round(avgThicknessScaled / scale));
}
