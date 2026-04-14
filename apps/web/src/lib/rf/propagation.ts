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
	if (radiusSq <= 0) return 0;
	const ratioSq = distSq / radiusSq;
	return 1 / (1 + ratioSq * ratioSq);
}

/**
 * Simpler signal model used by optimizer (tighter radius, steeper falloff).
 * signal = max(0, (1 - d/(1.5r))²)
 */
export function signalStrengthOptimizer(distance: number, radius: number): number {
	if (distance <= 0) return 1;
	if (radius <= 0) return 0;
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
	metersPerPixel = 0,
	defaultMaterialId = 0
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
					const matId = materialMap ? (materialMap[idx] ?? defaultMaterialId) : defaultMaterialId;
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

/**
 * Polar attenuation field — cumulative wall dB stored by angle and distance
 * from the AP. Built by marching outward in radial slices (720 angles = 0.5°).
 * 55× faster than the old Cartesian grid (360K vs 20M DDA steps).
 *
 * Lookup: atan2 → angle bucket, distance → distance bucket. O(1).
 * No field boundary artifacts. Wall shadows extend naturally in all directions.
 */
export interface AttenField {
	/** Cumulative dB at [angle * distBuckets + distIdx]. */
	data: Float32Array;
	angles: number;
	distBuckets: number;
	distStep: number; // world units per distance bucket
	apX: number;
	apY: number;
	/** Final (edge) attenuation per angle — used for pixels beyond maxDist. */
	edgeAtten: Float32Array;
}

const POLAR_ANGLES_FULL = 720; // 0.5° per slice
const POLAR_ANGLES_FAST = 360; // 1° per slice (drag mode)

/**
 * Build a polar attenuation field by marching outward from the AP in radial slices.
 * Each slice accumulates wall dB incrementally — no redundant ray marching.
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
	const fast = gridStep > ATTEN_GRID_STEP;
	const angles = fast ? POLAR_ANGLES_FAST : POLAR_ANGLES_FULL;
	const distStep = fast ? 6 : 3; // world units per distance bucket
	const distBuckets = Math.ceil(maxDist / distStep);
	const data = new Float32Array(angles * distBuckets);
	const edgeAtten = new Float32Array(angles);

	// AP in mask-local coords
	const apLX = apX - maskOriginX;
	const apLY = apY - maskOriginY;
	const angleStep = (2 * Math.PI) / angles;

	for (let a = 0; a < angles; a++) {
		const theta = a * angleStep;
		const cosT = Math.cos(theta);
		const sinT = Math.sin(theta);

		let cumDb = 0;
		let wasWall = false;
		const base = a * distBuckets;

		// Step pixel-by-pixel to never miss thin walls.
		// Store cumulative dB at bucket resolution for compact lookup.
		let nextBucket = 0;
		const totalPixels = Math.ceil(maxDist);
		for (let p = 0; p < totalPixels; p++) {
			const px = (apLX + cosT * p + 0.5) | 0;
			const py = (apLY + sinT * p + 0.5) | 0;

			if (px >= 0 && px < wallW && py >= 0 && py < wallH) {
				const idx = py * wallW + px;
				const isWall = wallData[idx] === 1;
				if (isWall && !wasWall) {
					if (materialMap) {
						const matId = materialMap[idx] ?? 0;
						cumDb += materialDb[matId] ?? defaultDb;
					} else {
						cumDb += defaultDb;
					}
				}
				wasWall = isWall;
			} else {
				wasWall = false;
			}

			// Write to bucket when we cross the boundary
			while (nextBucket < distBuckets && p >= (nextBucket + 0.5) * distStep) {
				data[base + nextBucket] = cumDb;
				nextBucket++;
			}
		}
		// Fill remaining buckets
		while (nextBucket < distBuckets) {
			data[base + nextBucket] = cumDb;
			nextBucket++;
		}
		edgeAtten[a] = cumDb;
	}

	return { data, angles, distBuckets, distStep, apX, apY, edgeAtten };
}

/** O(1) polar attenuation lookup: angle + distance → cumulative dB. */
export function lookupAtten(field: AttenField, wx: number, wy: number): number {
	const dx = wx - field.apX;
	const dy = wy - field.apY;
	const dist = Math.sqrt(dx * dx + dy * dy);
	if (dist < 0.5) return 0;

	// Angle bucket: atan2 → [0, 2π) → [0, angles)
	let theta = Math.atan2(dy, dx);
	if (theta < 0) theta += 2 * Math.PI;
	const ai = Math.min(field.angles - 1, ((theta / (2 * Math.PI)) * field.angles) | 0);

	// Distance bucket
	const di = (dist / field.distStep) | 0;
	if (di >= field.distBuckets) return field.edgeAtten[ai]!;

	return field.data[ai * field.distBuckets + di]!;
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
