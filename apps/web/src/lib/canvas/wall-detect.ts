import { createWorker, type Worker } from 'tesseract.js';
import { computeBuildingInterior } from './morph-interior.js';

export interface WallMask {
	dataUrl: string;
	width: number;
	height: number;
	originX: number;
	originY: number;
}

export interface DecodedWallMask {
	data: Uint8Array;
	width: number;
	height: number;
	/** World-space origin of the mask (default 0). */
	originX: number;
	originY: number;
}

let ocrWorker: Worker | null = null;

async function getOCRWorker(): Promise<Worker | null> {
	if (ocrWorker) return ocrWorker;
	try {
		ocrWorker = await createWorker('eng');
		// Set DPI to suppress "Estimating resolution" warnings
		await ocrWorker.setParameters({ user_defined_dpi: '150' });
		return ocrWorker;
	} catch {
		return null;
	}
}

/**
 * Detect walls from a floorplan image.
 * Pipeline: OCR text masking -> threshold -> remove small blobs -> remove exterior blobs -> binary mask.
 * Returns a wall mask at displayWidth resolution in world coordinates.
 */
export async function detectWalls(
	image: HTMLImageElement,
	displayWidth: number,
	options?: { skipOcr?: boolean }
): Promise<WallMask | null> {
	const displayScale = displayWidth / image.naturalWidth;
	const w = displayWidth;
	const h = Math.round(image.naturalHeight * displayScale);

	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	ctx.drawImage(image, 0, 0, w, h);

	// Step 1: OCR to find and mask text regions (raster images only)
	// SVGs already have <text> stripped by prepareSvgForDetection - OCR would
	// damage wall structure with aggressive bounding boxes
	if (!options?.skipOcr)
		try {
			const worker = await getOCRWorker();
			if (worker) {
				const [bgR, bgG, bgB] = sampleBorderRgb(ctx, w, h);
				const pad = Math.max(2, Math.round(w * 0.003));

				// Pass 1: detect horizontal/angled text with auto-rotation
				const { data } = await worker.recognize(canvas, { rotateAuto: true }, { blocks: true });
				maskWords(ctx, data, pad, bgR, bgG, bgB);

				// Pass 2: rotate 90 degrees to catch vertical text
				const rotCanvas = document.createElement('canvas');
				rotCanvas.width = h;
				rotCanvas.height = w;
				const rotCtx = rotCanvas.getContext('2d')!;
				rotCtx.translate(h, 0);
				rotCtx.rotate(Math.PI / 2);
				rotCtx.drawImage(canvas, 0, 0);

				const { data: rotData } = await worker.recognize(
					rotCanvas,
					{ rotateAuto: true },
					{ blocks: true }
				);
				// For rotated pass, mask on the rotated canvas then draw back
				maskWords(rotCtx, rotData, pad, bgR, bgG, bgB);
				// Redraw the cleaned rotated image back onto the original canvas
				ctx.save();
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				ctx.clearRect(0, 0, w, h);
				ctx.translate(0, h);
				ctx.rotate(-Math.PI / 2);
				ctx.drawImage(rotCanvas, 0, 0);
				ctx.restore();
			}
		} catch (e) {
			console.warn('[wall-detect] OCR failed:', e);
		}

	// Step 2: Grayscale + threshold to binary (1 = wall pixel)
	const imageData = ctx.getImageData(0, 0, w, h);
	const { data: pixels } = imageData;

	const gray = new Uint8Array(w * h);
	for (let i = 0; i < w * h; i++) {
		gray[i] = Math.round((pixels[i * 4]! + pixels[i * 4 + 1]! + pixels[i * 4 + 2]!) / 3);
	}

	// Detect background from edges
	let edgeSum = 0,
		edgeCount = 0;
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

	// Adaptive local thresholding: compare each pixel to its neighborhood average.
	// Catches thin/faint wall lines that global threshold misses.
	const binary = adaptiveThreshold(gray, w, h, darkBg);

	// Step 3: Remove small disconnected blobs (noise, dots, thin text remnants)
	const minBlobPx = Math.max(30, Math.round(w * h * 0.0003));
	filterSmallBlobs(binary, w, h, minBlobPx);

	// Step 4: Remove blobs outside the building exterior
	removeExteriorBlobs(binary, w, h);

	let wallCount = 0;
	for (let i = 0; i < w * h; i++) wallCount += binary[i]!;
	if (wallCount < 50) return null;

	// Step 5: Encode binary mask as PNG data URL
	const maskCanvas = document.createElement('canvas');
	maskCanvas.width = w;
	maskCanvas.height = h;
	const maskCtx = maskCanvas.getContext('2d')!;
	const maskImg = maskCtx.createImageData(w, h);
	for (let i = 0; i < w * h; i++) {
		const j = i * 4;
		if (binary[i]) {
			maskImg.data[j] = 255;
			maskImg.data[j + 1] = 255;
			maskImg.data[j + 2] = 255;
			maskImg.data[j + 3] = 255;
		}
	}
	maskCtx.putImageData(maskImg, 0, 0);

	return {
		dataUrl: maskCanvas.toDataURL('image/png'),
		width: w,
		height: h,
		originX: 0,
		originY: 0
	};
}

/** Decode a wall mask PNG data URL to a Uint8Array for fast pixel lookups */
export function decodeMask(
	dataUrl: string,
	width: number,
	height: number
): Promise<DecodedWallMask> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0);
			const data = ctx.getImageData(0, 0, width, height).data;
			const mask = new Uint8Array(width * height);
			for (let i = 0; i < mask.length; i++) {
				mask[i] = data[i * 4]! > 128 ? 1 : 0;
			}
			resolve({ data: mask, width, height, originX: 0, originY: 0 });
		};
		img.onerror = () =>
			resolve({ data: new Uint8Array(width * height), width, height, originX: 0, originY: 0 });
		img.src = dataUrl;
	});
}

/** Encode a binary wall mask Uint8Array back to a PNG data URL. */
export function encodeMask(data: Uint8Array, w: number, h: number): string {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	const imgData = ctx.createImageData(w, h);
	for (let i = 0; i < data.length; i++) {
		const j = i * 4;
		if (data[i]) {
			imgData.data[j] = 255;
			imgData.data[j + 1] = 255;
			imgData.data[j + 2] = 255;
			imgData.data[j + 3] = 255;
		}
	}
	ctx.putImageData(imgData, 0, 0);
	return canvas.toDataURL('image/png');
}

/** Count wall crossings along a ray using Bresenham's line algorithm.
 *  Each 0->1 transition is one wall crossing. */
export function countWallCrossings(
	mask: DecodedWallMask,
	x0: number,
	y0: number,
	x1: number,
	y1: number
): number {
	return bresenhamRayMarch(mask.data, mask.width, mask.height, x0, y0, x1, y1, null, null);
}

/** Compute total wall attenuation (dB) along a ray, using per-pixel material IDs.
 *  Falls back to defaultAttenuation when no material mask is provided.
 *  `stride` controls how many Bresenham steps between wall checks (1 = every pixel,
 *  3 = every 3rd pixel — faster for heatmap visualization where walls are 3+ px thick). */
export function computeWallAttenuation(
	mask: DecodedWallMask,
	materialMap: Uint8Array | null,
	materialDb: readonly { attenuation: number }[],
	defaultAttenuation: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	stride = 1
): number {
	return bresenhamRayMarch(
		mask.data,
		mask.width,
		mask.height,
		x0,
		y0,
		x1,
		y1,
		materialMap,
		materialDb.length > 0 ? materialDb : null,
		defaultAttenuation,
		stride
	);
}

/** Shared ray march. When materialDb is null, counts crossings.
 *  When materialDb is provided, returns total dB attenuation.
 *  stride=1: precise Bresenham (every pixel). stride>1: DDA sampling every Nth pixel. */
function bresenhamRayMarch(
	data: Uint8Array,
	width: number,
	height: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	materialMap: Uint8Array | null,
	materialDb: readonly { attenuation: number }[] | null,
	defaultAttenuation = 5,
	stride = 1
): number {
	const ix0 = Math.round(x0),
		iy0 = Math.round(y0);
	const ix1 = Math.round(x1),
		iy1 = Math.round(y1);

	// For stride > 1, use DDA with fewer total iterations instead of
	// Bresenham-every-pixel. True Nx speedup for heatmap visualization.
	if (stride > 1) {
		const lenX = ix1 - ix0;
		const lenY = iy1 - iy0;
		const steps = Math.max(Math.abs(lenX), Math.abs(lenY));
		const n = Math.ceil(steps / stride);
		if (n <= 0) return 0;
		const dx = lenX / n;
		const dy = lenY / n;

		let total = 0;
		let wasWall = false;
		for (let s = 0; s <= n; s++) {
			const px = Math.round(ix0 + s * dx);
			const py = Math.round(iy0 + s * dy);
			if (px >= 0 && px < width && py >= 0 && py < height) {
				const idx = py * width + px;
				const isWall = data[idx] === 1;
				if (isWall && !wasWall) {
					if (materialDb && materialMap) {
						const matId = materialMap[idx] ?? 0;
						total += materialDb[matId]?.attenuation ?? defaultAttenuation;
					} else if (materialDb) {
						total += defaultAttenuation;
					} else {
						total += 1;
					}
				}
				wasWall = isWall;
			} else {
				wasWall = false;
			}
		}
		return total;
	}

	// Precise Bresenham for stride=1 (optimizer, exact computation)
	let cx = ix0,
		cy = iy0;
	const adx = Math.abs(ix1 - ix0);
	const ady = Math.abs(iy1 - iy0);
	const sx = ix0 < ix1 ? 1 : -1;
	const sy = iy0 < iy1 ? 1 : -1;
	let err = adx - ady;

	let total = 0;
	let wasWall = false;

	while (true) {
		if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
			const idx = cy * width + cx;
			const isWall = data[idx] === 1;
			if (isWall && !wasWall) {
				if (materialDb && materialMap) {
					const matId = materialMap[idx] ?? 0;
					total += materialDb[matId]?.attenuation ?? defaultAttenuation;
				} else if (materialDb) {
					total += defaultAttenuation;
				} else {
					total += 1;
				}
			}
			wasWall = isWall;
		} else {
			wasWall = false;
		}

		if (cx === ix1 && cy === iy1) break;

		const e2 = 2 * err;
		if (e2 > -ady) {
			err -= ady;
			cx += sx;
		}
		if (e2 < adx) {
			err += adx;
			cy += sy;
		}
	}

	return total;
}

function filterSmallBlobs(binary: Uint8Array, w: number, h: number, minSize: number): void {
	const labels = new Int32Array(w * h).fill(-1);
	const blobPixels: number[][] = [];
	let nextLabel = 0;

	for (let i = 0; i < w * h; i++) {
		if (!binary[i] || labels[i] !== -1) continue;

		const label = nextLabel++;
		const pixels: number[] = [];
		const queue = [i];
		labels[i] = label;

		while (queue.length > 0) {
			const idx = queue.pop()!;
			pixels.push(idx);
			const x = idx % w;
			const y = Math.floor(idx / w);

			if (y > 0 && binary[idx - w] && labels[idx - w] === -1) {
				labels[idx - w] = label;
				queue.push(idx - w);
			}
			if (y < h - 1 && binary[idx + w] && labels[idx + w] === -1) {
				labels[idx + w] = label;
				queue.push(idx + w);
			}
			if (x > 0 && binary[idx - 1] && labels[idx - 1] === -1) {
				labels[idx - 1] = label;
				queue.push(idx - 1);
			}
			if (x < w - 1 && binary[idx + 1] && labels[idx + 1] === -1) {
				labels[idx + 1] = label;
				queue.push(idx + 1);
			}
		}

		blobPixels.push(pixels);
	}

	for (const pixels of blobPixels) {
		if (pixels.length < minSize) {
			for (const idx of pixels) binary[idx] = 0;
		}
	}
}

/** Remove wall blobs that are outside the building.
 *  Morphological close seals door gaps, flood fill identifies exterior,
 *  then wall blobs with no interior-adjacent pixels are removed. */
function removeExteriorBlobs(binary: Uint8Array, w: number, h: number): void {
	const { interior: fullInterior } = computeBuildingInterior(binary, w, h, {
		maxDim: 400,
		dilateRatio: 0.03,
		minDilateR: 5
	});

	// Label wall blobs at full resolution and check if they touch interior
	const labels = new Int32Array(w * h).fill(-1);
	const blobPixels: number[][] = [];
	const blobTouchesInterior: boolean[] = [];
	let nextLabel = 0;

	for (let i = 0; i < w * h; i++) {
		if (!binary[i] || labels[i] !== -1) continue;

		const label = nextLabel++;
		const pixels: number[] = [];
		let touches = false;
		const bq = [i];
		labels[i] = label;

		while (bq.length > 0) {
			const idx = bq.pop()!;
			pixels.push(idx);
			const x = idx % w,
				y = Math.floor(idx / w);

			// Check 4-connected neighbors for interior
			if (y > 0 && fullInterior[idx - w]) touches = true;
			if (y < h - 1 && fullInterior[idx + w]) touches = true;
			if (x > 0 && fullInterior[idx - 1]) touches = true;
			if (x < w - 1 && fullInterior[idx + 1]) touches = true;

			if (y > 0 && binary[idx - w] && labels[idx - w] === -1) {
				labels[idx - w] = label;
				bq.push(idx - w);
			}
			if (y < h - 1 && binary[idx + w] && labels[idx + w] === -1) {
				labels[idx + w] = label;
				bq.push(idx + w);
			}
			if (x > 0 && binary[idx - 1] && labels[idx - 1] === -1) {
				labels[idx - 1] = label;
				bq.push(idx - 1);
			}
			if (x < w - 1 && binary[idx + 1] && labels[idx + 1] === -1) {
				labels[idx + 1] = label;
				bq.push(idx + 1);
			}
		}

		blobPixels.push(pixels);
		blobTouchesInterior.push(touches);
	}

	// Remove blobs that don't touch interior (exterior decorations, legends)
	for (let b = 0; b < blobPixels.length; b++) {
		if (!blobTouchesInterior[b]) {
			for (const idx of blobPixels[b]!) binary[idx] = 0;
		}
	}
}

/** Sample the average border RGB for background fill */
function sampleBorderRgb(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number
): [number, number, number] {
	const d = ctx.getImageData(0, 0, w, h).data;
	let rSum = 0,
		gSum = 0,
		bSum = 0,
		count = 0;
	for (let x = 0; x < w; x++) {
		const i1 = x * 4;
		rSum += d[i1]!;
		gSum += d[i1 + 1]!;
		bSum += d[i1 + 2]!;
		const i2 = ((h - 1) * w + x) * 4;
		rSum += d[i2]!;
		gSum += d[i2 + 1]!;
		bSum += d[i2 + 2]!;
		count += 2;
	}
	for (let y = 1; y < h - 1; y++) {
		const i1 = y * w * 4;
		rSum += d[i1]!;
		gSum += d[i1 + 1]!;
		bSum += d[i1 + 2]!;
		const i2 = (y * w + w - 1) * 4;
		rSum += d[i2]!;
		gSum += d[i2 + 1]!;
		bSum += d[i2 + 2]!;
		count += 2;
	}
	return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
}

interface OcrBbox {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}
interface OcrSymbol {
	bbox: OcrBbox;
}
interface OcrWord {
	confidence: number;
	text: string;
	bbox: OcrBbox;
	symbols?: OcrSymbol[];
}
interface OcrData {
	blocks: Array<{
		paragraphs: Array<{ lines: Array<{ words: OcrWord[] }> }>;
	}> | null;
}

/** Mask text by erasing contrasting pixels within character-level bounding boxes.
 *  Uses Tesseract's symbol (char) boxes for tight masking that preserves nearby walls. */
function maskWords(
	ctx: CanvasRenderingContext2D,
	data: OcrData,
	pad: number,
	bgR: number,
	bgG: number,
	bgB: number
): void {
	if (!data.blocks) return;
	const w = ctx.canvas.width;
	const h = ctx.canvas.height;
	const imgData = ctx.getImageData(0, 0, w, h);
	const px = imgData.data;
	const bgBright = (bgR + bgG + bgB) / 3;
	const darkBg = bgBright < 128;
	const loThreshold = darkBg ? 0 : bgBright * 0.75;
	const hiThreshold = darkBg ? bgBright + (255 - bgBright) * 0.25 : 256;

	function eraseContour(bbox: OcrBbox): void {
		const bx0 = Math.max(0, bbox.x0 - pad);
		const by0 = Math.max(0, bbox.y0 - pad);
		const bx1 = Math.min(w - 1, bbox.x1 + pad);
		const by1 = Math.min(h - 1, bbox.y1 + pad);
		for (let y = by0; y <= by1; y++) {
			for (let x = bx0; x <= bx1; x++) {
				const i = (y * w + x) * 4;
				const bright = (px[i]! + px[i + 1]! + px[i + 2]!) / 3;
				if (darkBg ? bright > hiThreshold : bright < loThreshold) {
					px[i] = bgR;
					px[i + 1] = bgG;
					px[i + 2] = bgB;
				}
			}
		}
	}

	for (const block of data.blocks) {
		for (const para of block.paragraphs) {
			for (const line of para.lines) {
				for (const word of line.words) {
					if (word.confidence < 20 || word.text.length < 2) continue;
					// Use character-level boxes when available for tightest masking
					if (word.symbols && word.symbols.length > 0) {
						for (const sym of word.symbols) {
							eraseContour(sym.bbox);
						}
					} else {
						eraseContour(word.bbox);
					}
				}
			}
		}
	}

	ctx.putImageData(imgData, 0, 0);
}

/** Adaptive local threshold using integral image for O(1) per-pixel mean.
 *  Each pixel is compared to the mean of a KxK neighborhood.
 *  For dark backgrounds: pixel brighter than localMean + C → wall.
 *  For light backgrounds: pixel darker than localMean - C → wall. */
function adaptiveThreshold(gray: Uint8Array, w: number, h: number, darkBg: boolean): Uint8Array {
	// Build integral image for fast local mean computation
	const integral = new Float64Array((w + 1) * (h + 1));
	for (let y = 0; y < h; y++) {
		let rowSum = 0;
		for (let x = 0; x < w; x++) {
			rowSum += gray[y * w + x]!;
			integral[(y + 1) * (w + 1) + (x + 1)] = rowSum + integral[y * (w + 1) + (x + 1)]!;
		}
	}

	function localMean(x: number, y: number, r: number): number {
		const x0 = Math.max(0, x - r);
		const y0 = Math.max(0, y - r);
		const x1 = Math.min(w, x + r + 1);
		const y1 = Math.min(h, y + r + 1);
		const stride = w + 1;
		const sum =
			integral[y1 * stride + x1]! -
			integral[y0 * stride + x1]! -
			integral[y1 * stride + x0]! +
			integral[y0 * stride + x0]!;
		return sum / ((x1 - x0) * (y1 - y0));
	}

	const binary = new Uint8Array(w * h);
	const radius = Math.max(8, Math.round(Math.max(w, h) * 0.03));
	// C: how much a pixel must differ from local mean to be "wall"
	const C = darkBg ? 15 : -15;

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const val = gray[y * w + x]!;
			const mean = localMean(x, y, radius);
			if (darkBg) {
				binary[y * w + x] = val > mean + C ? 1 : 0;
			} else {
				binary[y * w + x] = val < mean + C ? 1 : 0;
			}
		}
	}

	return binary;
}
