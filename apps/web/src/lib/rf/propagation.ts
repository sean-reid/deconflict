/**
 * Shared RF propagation module — imported by both heatmap and optimizer workers.
 * Pure computation, no DOM APIs.
 *
 * Provides:
 * - Indoor signal power model (inverse quartic path loss)
 * - DDA wall ray march (stride-configurable)
 * - Precomputed wall attenuation field (build once, O(1) lookup)
 * - Base rate lookup table
 */

// ─── Signal model ──────────────────────────────────────────────────

/**
 * Indoor propagation: inverse quartic falloff (path loss exponent n=4).
 * signal = 1 / (1 + (d²/r²)²).  No sqrt — pure multiply + divide.
 */
export function signalPower(distSq: number, radiusSq: number): number {
	const ratioSq = distSq / radiusSq;
	return 1 / (1 + ratioSq * ratioSq);
}

/**
 * Simpler signal model used by optimizer (tighter radius, steeper falloff).
 * signal = max(0, (1 - d/(1.5r))²)
 */
export function signalStrengthOptimizer(distance: number, radius: number): number {
	if (distance <= 0) return 1;
	const ratio = distance / radius;
	if (ratio >= 1.5) return 0;
	return Math.pow(1 - ratio / 1.5, 2);
}

// ─── Wall ray march ────────────────────────────────────────────────

/**
 * DDA ray march with configurable stride.
 *
 * When `dbPerMeterArr` is provided, uses thickness-aware accumulation:
 * every step through wall material adds `dbPerMeter * stepLengthMeters`.
 * Otherwise falls back to transition-based counting (flat dB per crossing).
 *
 * stride=1 checks every pixel; stride=3 checks every 3rd.
 */
export function rayMarchWallAtten(
	wallData: Uint8Array,
	w: number,
	h: number,
	materialMap: Uint8Array | null,
	materialDb: number[],
	defaultDb: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	stride = 3,
	dbPerMeterArr?: number[],
	metersPerPixel = 0
): number {
	const ix0 = Math.round(x0),
		iy0 = Math.round(y0);
	const lenX = Math.round(x1) - ix0;
	const lenY = Math.round(y1) - iy0;
	const steps = Math.max(Math.abs(lenX), Math.abs(lenY));
	const n = Math.ceil(steps / stride);
	if (n <= 0) return 0;
	const dx = lenX / n;
	const dy = lenY / n;

	// Step length in meters (for thickness-aware mode)
	const stepLen = metersPerPixel > 0 ? metersPerPixel * stride : 0;
	const thicknessAware = dbPerMeterArr && stepLen > 0;

	let total = 0;
	let wasWall = false;
	for (let s = 0; s <= n; s++) {
		const px = (ix0 + s * dx + 0.5) | 0;
		const py = (iy0 + s * dy + 0.5) | 0;
		if (px >= 0 && px < w && py >= 0 && py < h) {
			const idx = py * w + px;
			const isWall = wallData[idx] === 1;

			if (thicknessAware) {
				// Thickness-aware: accumulate dB for every step through wall
				if (isWall) {
					const matId = materialMap ? (materialMap[idx] ?? 0) : 0;
					const dbpm = dbPerMeterArr[matId] ?? defaultDb / 0.15; // fallback: assume 0.15m wall
					total += dbpm * stepLen;
				}
			} else {
				// Transition-based: flat dB per 0→1 crossing
				if (isWall && !wasWall) {
					if (materialMap) {
						const matId = materialMap[idx] ?? 0;
						total += materialDb[matId] ?? defaultDb;
					} else {
						total += defaultDb;
					}
				}
			}
			wasWall = isWall;
		} else {
			wasWall = false;
		}
	}
	return total;
}

/**
 * Count wall crossings (0→1 transitions) along a ray.
 * Used by optimizer for wall-crossing count (multiplied by flat dB).
 */
export function countWallCrossings(
	wallData: Uint8Array,
	w: number,
	h: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	stride = 1
): number {
	const ix0 = Math.round(x0),
		iy0 = Math.round(y0);
	const lenX = Math.round(x1) - ix0;
	const lenY = Math.round(y1) - iy0;
	const steps = Math.max(Math.abs(lenX), Math.abs(lenY));
	const n = stride > 1 ? Math.ceil(steps / stride) : steps;
	if (n <= 0) return 0;
	const dx = lenX / n;
	const dy = lenY / n;

	let count = 0;
	let wasWall = false;
	for (let s = 0; s <= n; s++) {
		const px = (ix0 + s * dx + 0.5) | 0;
		const py = (iy0 + s * dy + 0.5) | 0;
		if (px >= 0 && px < w && py >= 0 && py < h) {
			const isWall = wallData[py * w + px] === 1;
			if (isWall && !wasWall) count++;
			wasWall = isWall;
		} else {
			wasWall = false;
		}
	}
	return count;
}

// ─── Precomputed attenuation field ────────────────────────────────

/** Grid spacing for the precomputed attenuation field (in wall-mask pixels). */
export const ATTEN_GRID_STEP = 6;

export interface AttenField {
	grid: Float32Array;
	cols: number;
	rows: number;
	step: number;
	originX: number; // world-space origin of the grid (may be negative)
	originY: number;
	apX: number; // AP position in world space (for edge projection)
	apY: number;
}

/**
 * Precompute a coarse attenuation field from an AP position.
 * Grid extends to cover the AP's full signal range (not just the mask bounds)
 * so wall shadows project correctly beyond the mask boundary.
 */
export function buildAttenField(
	apX: number,
	apY: number,
	maxDist: number,
	wallData: Uint8Array,
	wallW: number,
	wallH: number,
	materialMap: Uint8Array | null,
	materialDb: number[],
	defaultDb: number,
	gridStep = ATTEN_GRID_STEP,
	maskOriginX = 0,
	maskOriginY = 0
): AttenField {
	// Field grid covers the wall mask area in world coordinates
	const originX = maskOriginX;
	const originY = maskOriginY;
	const cols = Math.ceil(wallW / gridStep);
	const rows = Math.ceil(wallH / gridStep);
	const grid = new Float32Array(cols * rows);

	// AP position in mask-local coordinates for ray marching
	const apLX = apX - maskOriginX;
	const apLY = apY - maskOriginY;

	// Ray-march cells within maxDist of the AP (performance bound).
	// The field grid covers the full mask so lookupAtten works everywhere,
	// but distant cells keep their default 0 (no visible contribution since
	// signal is negligible there). The heatmap's lookupAtten ray-projects
	// out-of-range cells back to the nearest computed edge cell.
	const maxDistSq = maxDist * maxDist;
	for (let r = 0; r < rows; r++) {
		const wy = originY + r * gridStep + (gridStep >> 1);
		for (let c = 0; c < cols; c++) {
			const wx = originX + c * gridStep + (gridStep >> 1);
			const dx = wx - apX;
			const dy = wy - apY;
			if (dx * dx + dy * dy > maxDistSq) continue;
			// Ray march in mask-local pixel coordinates
			grid[r * cols + c] = rayMarchWallAtten(
				wallData,
				wallW,
				wallH,
				materialMap,
				materialDb,
				defaultDb,
				apLX,
				apLY,
				wx - maskOriginX,
				wy - maskOriginY
			);
		}
	}

	return { grid, cols, rows, step: gridStep, originX, originY, apX, apY };
}

/** O(1) wall attenuation lookup from a precomputed field.
 *  For out-of-bounds pixels, projects back along the AP→pixel ray to the
 *  field edge — the accumulated wall loss at the mask boundary. */
export function lookupAtten(field: AttenField, wx: number, wy: number): number {
	const s = field.step;
	let gc = ((wx - field.originX) / s + 0.5) | 0;
	let gr = ((wy - field.originY) / s + 0.5) | 0;

	if (gc >= 0 && gc < field.cols && gr >= 0 && gr < field.rows) {
		return field.grid[gr * field.cols + gc]!;
	}

	// Out of bounds: find where the AP→pixel ray exits the field.
	const apGC = (field.apX - field.originX) / s;
	const apGR = (field.apY - field.originY) / s;
	const dgc = gc - apGC;
	const dgr = gr - apGR;
	if (dgc === 0 && dgr === 0) return 0;

	// Ray-box exit: find the smallest t > 0 where the ray crosses a field boundary
	let tExit = 1;
	if (dgc > 0) {
		const t = (field.cols - 0.5 - apGC) / dgc;
		if (t > 0 && t < tExit) tExit = t;
	} else if (dgc < 0) {
		const t = (-0.5 - apGC) / dgc;
		if (t > 0 && t < tExit) tExit = t;
	}
	if (dgr > 0) {
		const t = (field.rows - 0.5 - apGR) / dgr;
		if (t > 0 && t < tExit) tExit = t;
	} else if (dgr < 0) {
		const t = (-0.5 - apGR) / dgr;
		if (t > 0 && t < tExit) tExit = t;
	}

	gc = Math.max(0, Math.min(field.cols - 1, Math.round(apGC + dgc * tExit)));
	gr = Math.max(0, Math.min(field.rows - 1, Math.round(apGR + dgr * tExit)));
	return field.grid[gr * field.cols + gc]!;
}

// ─── Attenuation field cache ──────────────────────────────────────

const attenCache = new Map<string, AttenField>();
let wallGeneration = 0;
let cachedGeneration = -1;

/** Call when wall/material data changes to invalidate cached fields. */
export function invalidateAttenCache(): void {
	wallGeneration++;
}

/**
 * Get or build a cached attenuation field for an AP.
 * `fast` mode: coarser grid (12px) + bigger quantization (12px) for drag responsiveness.
 * `full` mode: fine grid (6px) + small quantization (4px) for accuracy when placed.
 */
export function getAttenField(
	apX: number,
	apY: number,
	radius: number,
	wallData: Uint8Array,
	wallW: number,
	wallH: number,
	materialMap: Uint8Array | null,
	materialDb: number[],
	defaultDb: number,
	fast = false,
	maskOriginX = 0,
	maskOriginY = 0
): AttenField {
	if (cachedGeneration !== wallGeneration) {
		attenCache.clear();
		cachedGeneration = wallGeneration;
	}

	const q = fast ? 12 : 4;
	const qx = (apX / q) | 0;
	const qy = (apY / q) | 0;
	const key = `${fast ? 'f' : 'a'}:${qx}:${qy}:${(radius / 4) | 0}`;

	let field = attenCache.get(key);
	if (!field) {
		const gridStep = fast ? 12 : ATTEN_GRID_STEP;
		field = buildAttenField(
			apX,
			apY,
			radius * 3,
			wallData,
			wallW,
			wallH,
			materialMap,
			materialDb,
			defaultDb,
			gridStep,
			maskOriginX,
			maskOriginY
		);
		attenCache.set(key, field);
		if (attenCache.size > 10) {
			const oldest = attenCache.keys().next().value!;
			attenCache.delete(oldest);
		}
	}
	return field;
}

// ─── Range from TX power ──────────────────────────────────────────

/** Reference path loss at 1m (dB) by band — ITU indoor model. */
const PL0: Record<string, number> = {
	'2.4ghz': 40,
	'5ghz': 47,
	'6ghz': 49
};

/** Receiver sensitivity threshold (dBm). Typical WiFi client minimum. */
const SENSITIVITY = -85;

/** Indoor path loss exponent. 4.0 = office/residential with typical obstacles.
 *  Consistent with the quartic signal model used by the heatmap renderer. */
const PATH_LOSS_N = 4.0;

/**
 * Compute estimated indoor coverage range from TX power and band.
 * Uses log-distance path loss model: PL(d) = PL₀ + 10·n·log₁₀(d)
 * Returns range in meters.
 */
export function rangeFromPower(txPowerDbm: number, band: string): number {
	const pl0 = PL0[band] ?? 47;
	const budget = txPowerDbm - pl0 - SENSITIVITY; // link budget in dB
	if (budget <= 0) return 1;
	return Math.pow(10, budget / (10 * PATH_LOSS_N));
}

// ─── Base rate lookup ─────────────────────────────────────────────

const BASE_RATES: Record<string, Record<number, number>> = {
	'2.4ghz': { 20: 72, 40: 150 },
	'5ghz': { 20: 86, 40: 200, 80: 433, 160: 867 },
	'6ghz': { 20: 86, 40: 200, 80: 433, 160: 867, 320: 1376 }
};

export function getBaseRate(band: string, channelWidth: number): number {
	return BASE_RATES[band]?.[channelWidth] ?? 72;
}
