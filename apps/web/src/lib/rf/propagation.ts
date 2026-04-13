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
 * Returns total dB attenuation along the ray (sum of per-material dB on wall transitions).
 * stride=1 checks every pixel; stride=3 checks every 3rd (3x faster, walls must be ≥3px thick).
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
	stride = 3
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

	let total = 0;
	let wasWall = false;
	for (let s = 0; s <= n; s++) {
		const px = (ix0 + s * dx + 0.5) | 0;
		const py = (iy0 + s * dy + 0.5) | 0;
		if (px >= 0 && px < w && py >= 0 && py < h) {
			const idx = py * w + px;
			const isWall = wallData[idx] === 1;
			if (isWall && !wasWall) {
				if (materialMap) {
					const matId = materialMap[idx] ?? 0;
					total += materialDb[matId] ?? defaultDb;
				} else {
					total += defaultDb;
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
}

/**
 * Precompute a coarse attenuation field from an AP position.
 * One DDA ray march per grid point. Only computes within `maxDist` of the AP.
 * Subsequent lookups are O(1).
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
	defaultDb: number
): AttenField {
	const step = ATTEN_GRID_STEP;
	const cols = Math.ceil(wallW / step);
	const rows = Math.ceil(wallH / step);
	const grid = new Float32Array(cols * rows);
	const maxDistSq = maxDist * maxDist;

	for (let r = 0; r < rows; r++) {
		const wy = r * step + (step >> 1);
		for (let c = 0; c < cols; c++) {
			const wx = c * step + (step >> 1);
			const dx = wx - apX;
			const dy = wy - apY;
			if (dx * dx + dy * dy > maxDistSq) continue;
			grid[r * cols + c] = rayMarchWallAtten(
				wallData,
				wallW,
				wallH,
				materialMap,
				materialDb,
				defaultDb,
				apX,
				apY,
				wx,
				wy
			);
		}
	}

	return { grid, cols, rows };
}

/** O(1) wall attenuation lookup from a precomputed field. */
export function lookupAtten(field: AttenField, wx: number, wy: number): number {
	const step = ATTEN_GRID_STEP;
	const gc = (wx / step + 0.5) | 0;
	const gr = (wy / step + 0.5) | 0;
	if (gc < 0 || gc >= field.cols || gr < 0 || gr >= field.rows) return 0;
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
 * AP positions are quantized to a 4px grid to reuse fields during slow drags.
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
	defaultDb: number
): AttenField {
	if (cachedGeneration !== wallGeneration) {
		attenCache.clear();
		cachedGeneration = wallGeneration;
	}

	const qx = (apX / 4) | 0;
	const qy = (apY / 4) | 0;
	const key = `${qx}:${qy}:${(radius / 4) | 0}`;

	let field = attenCache.get(key);
	if (!field) {
		field = buildAttenField(
			apX,
			apY,
			radius * 2,
			wallData,
			wallW,
			wallH,
			materialMap,
			materialDb,
			defaultDb
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
