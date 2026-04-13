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
	step: number; // grid spacing used when this field was built
}

/**
 * Precompute a coarse attenuation field from an AP position.
 * `gridStep` controls resolution: 6 = accurate, 12 = fast (for drag).
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
	gridStep = ATTEN_GRID_STEP
): AttenField {
	const cols = Math.ceil(wallW / gridStep);
	const rows = Math.ceil(wallH / gridStep);
	const grid = new Float32Array(cols * rows);
	const maxDistSq = maxDist * maxDist;

	for (let r = 0; r < rows; r++) {
		const wy = r * gridStep + (gridStep >> 1);
		for (let c = 0; c < cols; c++) {
			const wx = c * gridStep + (gridStep >> 1);
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

	return { grid, cols, rows, step: gridStep };
}

/** O(1) wall attenuation lookup from a precomputed field. */
export function lookupAtten(field: AttenField, wx: number, wy: number): number {
	const s = field.step;
	const gc = (wx / s + 0.5) | 0;
	const gr = (wy / s + 0.5) | 0;
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
	fast = false
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
			gridStep
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
