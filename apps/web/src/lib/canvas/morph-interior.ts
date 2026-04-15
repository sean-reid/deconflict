/**
 * Morphological operations and building interior detection.
 * Used by boundary-detect, wall-detect, optimizer-worker, and room detection.
 * No DOM dependencies — safe for Web Workers.
 */

export interface InteriorResult {
	/** 1 = interior (inside building, not wall), 0 = exterior or wall */
	interior: Uint8Array;
	/** 1 = exterior (reachable from border), 0 = not exterior */
	exterior: Uint8Array;
}

export interface MorphInteriorOptions {
	/** Downsample to this max dimension before morph close. 0 = no downsample. */
	maxDim?: number;
	/** Dilation radius as fraction of (downsampled) width. Default 0.04. */
	dilateRatio?: number;
	/** Minimum dilation radius in pixels. Default 10. */
	minDilateR?: number;
}

// ─── Reusable morphological operations ─────────────────────────────

/**
 * Dilate truthy pixels in a binary mask by a square radius.
 * Each truthy pixel expands to fill a (2r+1)×(2r+1) square.
 * Returns a new mask (does not mutate input).
 */
export function dilateMask(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
	const out = new Uint8Array(mask);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (!mask[y * w + x]) continue;
			const ylo = Math.max(0, y - radius);
			const yhi = Math.min(h - 1, y + radius);
			const xlo = Math.max(0, x - radius);
			const xhi = Math.min(w - 1, x + radius);
			for (let ny = ylo; ny <= yhi; ny++) {
				for (let nx = xlo; nx <= xhi; nx++) {
					out[ny * w + nx] = 1;
				}
			}
		}
	}
	return out;
}

/**
 * Erode: expand truthy pixels in a binary mask by a square radius.
 * The inverse of dilate — each truthy pixel spreads its value to neighbors.
 * Used to restore wall thickness after dilation.
 */
export function erodeMask(mask: Uint8Array, w: number, h: number, radius: number): Uint8Array {
	const out = new Uint8Array(mask);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (mask[y * w + x] !== 1) continue;
			const ylo = Math.max(0, y - radius);
			const yhi = Math.min(h - 1, y + radius);
			const xlo = Math.max(0, x - radius);
			const xhi = Math.min(w - 1, x + radius);
			for (let ny = ylo; ny <= yhi; ny++) {
				for (let nx = xlo; nx <= xhi; nx++) {
					out[ny * w + nx] = 1;
				}
			}
		}
	}
	return out;
}

/**
 * Flood fill from all border pixels through passable (truthy) pixels.
 * Returns a mask where 1 = reachable from border (exterior).
 */
export function floodFillExterior(passable: Uint8Array, w: number, h: number): Uint8Array {
	const exterior = new Uint8Array(w * h);
	const queue: number[] = [];

	// Seed from all border pixels
	for (let x = 0; x < w; x++) {
		if (passable[x]) queue.push(x);
		if (passable[(h - 1) * w + x]) queue.push((h - 1) * w + x);
	}
	for (let y = 0; y < h; y++) {
		if (passable[y * w]) queue.push(y * w);
		if (passable[y * w + w - 1]) queue.push(y * w + w - 1);
	}

	while (queue.length > 0) {
		const idx = queue.pop()!;
		if (exterior[idx]) continue;
		exterior[idx] = 1;
		const x = idx % w;
		const y = Math.floor(idx / w);
		if (y > 0 && !exterior[idx - w] && passable[idx - w]) queue.push(idx - w);
		if (y < h - 1 && !exterior[idx + w] && passable[idx + w]) queue.push(idx + w);
		if (x > 0 && !exterior[idx - 1] && passable[idx - 1]) queue.push(idx - 1);
		if (x < w - 1 && !exterior[idx + 1] && passable[idx + 1]) queue.push(idx + 1);
	}

	return exterior;
}

// ─── Building interior detection ───────────────────────────────────

/**
 * Compute building interior from a binary wall mask.
 * Pipeline: optional downsample → morph close (dilate+erode) → flood fill exterior → interior.
 *
 * @param wallMask Binary mask: 1 = wall pixel, 0 = passable
 * @param w Mask width
 * @param h Mask height
 * @param options Tuning parameters
 * @returns Interior and exterior masks at the ORIGINAL (w x h) resolution
 */
export function computeBuildingInterior(
	wallMask: Uint8Array,
	w: number,
	h: number,
	options?: MorphInteriorOptions
): InteriorResult {
	const maxDim = options?.maxDim ?? 0;
	const dilateRatio = options?.dilateRatio ?? 0.04;
	const minDilateR = options?.minDilateR ?? 10;

	// Determine working resolution
	const needsDownsample = maxDim > 0 && Math.max(w, h) > maxDim;
	const rs = needsDownsample ? maxDim / Math.max(w, h) : 1;
	const sw = Math.round(w * rs);
	const sh = Math.round(h * rs);

	// Downsample wall mask if needed
	let small: Uint8Array;
	if (needsDownsample) {
		small = new Uint8Array(sw * sh);
		for (let sy = 0; sy < sh; sy++) {
			const oy = Math.min(h - 1, Math.round(sy / rs));
			for (let sx = 0; sx < sw; sx++) {
				const ox = Math.min(w - 1, Math.round(sx / rs));
				small[sy * sw + sx] = wallMask[oy * w + ox]!;
			}
		}
	} else {
		small = wallMask;
	}

	const dilateR = Math.max(minDilateR, Math.round(sw * dilateRatio));

	// Passable map: 1 = can flood, 0 = wall blocks
	const passable = new Uint8Array(sw * sh);
	for (let i = 0; i < sw * sh; i++) passable[i] = small[i] ? 0 : 1;

	// Morphological close: dilate walls (shrink passable) then erode back
	const dilated = dilateMask(small, sw, sh, dilateR);
	const closedPass = new Uint8Array(sw * sh);
	for (let i = 0; i < sw * sh; i++) closedPass[i] = dilated[i] ? 0 : 1;
	const eroded = erodeMask(closedPass, sw, sh, dilateR);

	// Flood fill exterior from border
	const smallExterior = floodFillExterior(eroded, sw, sh);

	// Upsample to original resolution if needed
	const exterior = new Uint8Array(w * h);
	const interior = new Uint8Array(w * h);

	if (needsDownsample) {
		for (let y = 0; y < h; y++) {
			const sy = Math.min(sh - 1, Math.round(y * rs));
			for (let x = 0; x < w; x++) {
				const sx = Math.min(sw - 1, Math.round(x * rs));
				if (smallExterior[sy * sw + sx]) {
					exterior[y * w + x] = 1;
				}
				if (!smallExterior[sy * sw + sx] && !wallMask[y * w + x]) {
					interior[y * w + x] = 1;
				}
			}
		}
	} else {
		for (let i = 0; i < w * h; i++) {
			exterior[i] = smallExterior[i]!;
			if (!smallExterior[i] && !wallMask[i]) {
				interior[i] = 1;
			}
		}
	}

	return { interior, exterior };
}
