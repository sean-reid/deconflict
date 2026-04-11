/**
 * Shared morphological close + flood fill utility.
 * Computes building interior from a binary wall mask.
 * Used by boundary-detect, wall-detect, and optimizer-worker.
 * No DOM dependencies - safe for Web Workers.
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

	// Dilate walls (shrink passable region)
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

	// Erode walls back (dilate passable region)
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
	const smallExterior = new Uint8Array(sw * sh);
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
		if (smallExterior[idx]) continue;
		smallExterior[idx] = 1;
		const x = idx % sw,
			y = Math.floor(idx / sw);
		if (y > 0 && !smallExterior[idx - sw] && closedPass[idx - sw]) queue.push(idx - sw);
		if (y < sh - 1 && !smallExterior[idx + sw] && closedPass[idx + sw]) queue.push(idx + sw);
		if (x > 0 && !smallExterior[idx - 1] && closedPass[idx - 1]) queue.push(idx - 1);
		if (x < sw - 1 && !smallExterior[idx + 1] && closedPass[idx + 1]) queue.push(idx + 1);
	}

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
