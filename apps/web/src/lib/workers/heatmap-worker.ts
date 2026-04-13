/// <reference lib="webworker" />

/**
 * Heatmap Web Worker — generates signal coverage maps off the main thread.
 *
 * Key optimization: precomputed wall attenuation fields. Instead of ray-marching
 * from each AP to each heatmap cell (O(cells × ray_length)), we precompute a
 * coarse grid of attenuation values from each AP (one ray march per grid point),
 * then look up O(1) during rendering. ~10x faster with walls.
 */

const CELL_SIZE = 6;
const MAX_RATIO_SQ = 4;
const WALL_SIGNAL_THRESHOLD = 0.05;

// Attenuation field grid spacing (in wall-mask pixels / world units)
const ATTEN_STEP = 6;

// --- Signal model ---

function signalPower(distSq: number, radiusSq: number): number {
	const ratioSq = distSq / radiusSq;
	return 1 / (1 + ratioSq * ratioSq);
}

// --- Color LUT ---

const STOPS: [number, number, number, number, number][] = [
	[0.0, 180, 40, 40, 128],
	[0.15, 220, 120, 20, 115],
	[0.35, 210, 190, 30, 102],
	[0.55, 130, 190, 60, 94],
	[0.75, 80, 170, 80, 89],
	[1.0, 40, 150, 40, 89]
];

function packColor(r: number, g: number, b: number, a: number): number {
	return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

const LUT = new Uint32Array(256);
const DEAD_COLOR = packColor(60, 30, 30, 115);

for (let i = 0; i < 256; i++) {
	const ratio = i / 255;
	let r = 40,
		g = 150,
		b = 40,
		a = 89;
	for (let s = 1; s < STOPS.length; s++) {
		if (ratio <= STOPS[s]![0]) {
			const lo = STOPS[s - 1]!;
			const hi = STOPS[s]!;
			const t = (ratio - lo[0]) / (hi[0] - lo[0]);
			r = lo[1] + t * (hi[1] - lo[1]);
			g = lo[2] + t * (hi[2] - lo[2]);
			b = lo[3] + t * (hi[3] - lo[3]);
			a = lo[4] + t * (hi[4] - lo[4]);
			break;
		}
	}
	LUT[i] = packColor(r, g, b, a);
}

// --- DDA ray march (stride-3) for precomputation ---

function rayMarchDDA(
	data: Uint8Array,
	w: number,
	h: number,
	matMap: Uint8Array | null,
	matDb: number[],
	defDb: number,
	x0: number,
	y0: number,
	x1: number,
	y1: number
): number {
	const ix0 = Math.round(x0),
		iy0 = Math.round(y0);
	const lenX = Math.round(x1) - ix0;
	const lenY = Math.round(y1) - iy0;
	const steps = Math.max(Math.abs(lenX), Math.abs(lenY));
	const n = Math.ceil(steps / 3); // stride 3
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
			const isWall = data[idx] === 1;
			if (isWall && !wasWall) {
				if (matMap) {
					const matId = matMap[idx] ?? 0;
					total += matDb[matId] ?? defDb;
				} else {
					total += defDb;
				}
			}
			wasWall = isWall;
		} else {
			wasWall = false;
		}
	}
	return total;
}

// --- Precomputed attenuation field ---

interface AttenField {
	grid: Float32Array; // dB loss at each grid point
	cols: number;
	rows: number;
	apX: number;
	apY: number;
}

function buildAttenField(
	apX: number,
	apY: number,
	radius: number,
	wallData: Uint8Array,
	wallW: number,
	wallH: number,
	matMap: Uint8Array | null,
	matDb: number[],
	defDb: number
): AttenField {
	const cols = Math.ceil(wallW / ATTEN_STEP);
	const rows = Math.ceil(wallH / ATTEN_STEP);
	const grid = new Float32Array(cols * rows);

	const maxDist = radius * 2; // only precompute within signal range
	const maxDistSq = maxDist * maxDist;

	for (let r = 0; r < rows; r++) {
		const wy = r * ATTEN_STEP + (ATTEN_STEP >> 1);
		for (let c = 0; c < cols; c++) {
			const wx = c * ATTEN_STEP + (ATTEN_STEP >> 1);
			const dx = wx - apX;
			const dy = wy - apY;
			if (dx * dx + dy * dy > maxDistSq) continue; // skip far points
			grid[r * cols + c] = rayMarchDDA(
				wallData,
				wallW,
				wallH,
				matMap,
				matDb,
				defDb,
				apX,
				apY,
				wx,
				wy
			);
		}
	}

	return { grid, cols, rows, apX, apY };
}

/** O(1) wall attenuation lookup from precomputed field */
function lookupAtten(field: AttenField, wx: number, wy: number): number {
	const gc = (wx / ATTEN_STEP + 0.5) | 0;
	const gr = (wy / ATTEN_STEP + 0.5) | 0;
	if (gc < 0 || gc >= field.cols || gr < 0 || gr >= field.rows) return 0;
	return field.grid[gr * field.cols + gc]!;
}

// --- Base rate lookup ---

const BASE_RATES: Record<string, Record<number, number>> = {
	'2.4ghz': { 20: 72, 40: 150 },
	'5ghz': { 20: 86, 40: 200, 80: 433, 160: 867 },
	'6ghz': { 20: 86, 40: 200, 80: 433, 160: 867, 320: 1376 }
};

function getBaseRate(band: string, channelWidth: number): number {
	return BASE_RATES[band]?.[channelWidth] ?? 72;
}

// --- Worker state ---

let wallData: Uint8Array | null = null;
let wallW = 0;
let wallH = 0;
let materialMap: Uint8Array | null = null;
let materialDb: number[] = [];
let defaultDb = 5;

// Cached attenuation fields keyed by "apX:apY:radius"
const attenCache = new Map<string, AttenField>();
let wallVersion = 0;
let cachedWallVersion = -1;

function getAttenField(apX: number, apY: number, radius: number): AttenField | null {
	if (!wallData) return null;

	// Invalidate cache if walls changed
	if (cachedWallVersion !== wallVersion) {
		attenCache.clear();
		cachedWallVersion = wallVersion;
	}

	// Quantize AP position to reduce cache churn during drag (snap to 4px grid)
	const qx = (apX / 4) | 0;
	const qy = (apY / 4) | 0;
	const key = `${qx}:${qy}:${(radius / 4) | 0}`;

	let field = attenCache.get(key);
	if (!field) {
		field = buildAttenField(
			apX,
			apY,
			radius,
			wallData,
			wallW,
			wallH,
			materialMap,
			materialDb,
			defaultDb
		);
		attenCache.set(key, field);
		// Evict old entries (keep last 10 AP positions)
		if (attenCache.size > 10) {
			const oldest = attenCache.keys().next().value!;
			attenCache.delete(oldest);
		}
	}
	return field;
}

// --- Message handler ---

interface ApData {
	x: number;
	y: number;
	interferenceRadius: number;
	band: string;
	channelWidth: number;
}

interface RenderMsg {
	type: 'render';
	id: number;
	aps: ApData[];
	ispSpeed: number;
	cameraInverse: number[];
	viewWidth: number;
	viewHeight: number;
}

interface SetWallsMsg {
	type: 'setWalls';
	wallData: ArrayBuffer | null;
	materialMap: ArrayBuffer | null;
	materialDb: number[];
	defaultDb: number;
	width: number;
	height: number;
}

self.onmessage = (e: MessageEvent<RenderMsg | SetWallsMsg>) => {
	const msg = e.data;

	if (msg.type === 'setWalls') {
		wallData = msg.wallData ? new Uint8Array(msg.wallData) : null;
		materialMap = msg.materialMap ? new Uint8Array(msg.materialMap) : null;
		materialDb = msg.materialDb;
		defaultDb = msg.defaultDb;
		wallW = msg.width;
		wallH = msg.height;
		wallVersion++;
		return;
	}

	if (msg.type === 'render') {
		const t0 = performance.now();
		const { id, aps, ispSpeed, cameraInverse: inv, viewWidth: width, viewHeight: height } = msg;
		const cellSize = CELL_SIZE;
		const cols = Math.ceil(width / cellSize);
		const rows = Math.ceil(height / cellSize);

		// Max throughput
		let maxTp = 0;
		for (const ap of aps) {
			const base = getBaseRate(ap.band, ap.channelWidth) * 0.5;
			if (base > maxTp) maxTp = base;
		}
		if (ispSpeed > 0 && ispSpeed < maxTp) maxTp = ispSpeed;
		if (maxTp <= 0) maxTp = 100;
		const invMax = 1 / maxTp;

		// Per-AP arrays
		const n = aps.length;
		const apX = new Float64Array(n);
		const apY = new Float64Array(n);
		const apRadSq = new Float64Array(n);
		const apCutSq = new Float64Array(n);
		const apBase = new Float64Array(n);
		const attenFields: (AttenField | null)[] = [];
		for (let i = 0; i < n; i++) {
			const ap = aps[i]!;
			apX[i] = ap.x;
			apY[i] = ap.y;
			const rSq = ap.interferenceRadius * ap.interferenceRadius;
			apRadSq[i] = rSq;
			apCutSq[i] = rSq * MAX_RATIO_SQ;
			apBase[i] = getBaseRate(ap.band, ap.channelWidth) * 0.5;
			// Build or retrieve cached attenuation field
			attenFields.push(getAttenField(ap.x, ap.y, ap.interferenceRadius));
		}

		const ia = inv[0]!,
			ib = inv[1]!,
			ic = inv[2]!,
			idd = inv[3]!,
			ie = inv[4]!,
			ig = inv[5]!;

		const buf = new ArrayBuffer(width * height * 4);
		const u32 = new Uint32Array(buf);

		for (let row = 0; row < rows; row++) {
			const sy = row * cellSize + (cellSize >> 1);
			const py0 = row * cellSize;
			const py1 = Math.min(py0 + cellSize, height);

			for (let col = 0; col < cols; col++) {
				const sx = col * cellSize + (cellSize >> 1);
				const wx = ia * sx + ic * sy + ie;
				const wy = ib * sx + idd * sy + ig;

				let best = 0;

				for (let i = 0; i < n; i++) {
					const dx = wx - apX[i]!;
					const dy = wy - apY[i]!;
					const dSq = dx * dx + dy * dy;
					if (dSq > apCutSq[i]!) continue;

					const signal = signalPower(dSq, apRadSq[i]!);
					let tp = apBase[i]! * signal;

					// O(1) wall attenuation from precomputed field
					const field = attenFields[i];
					if (field && signal > WALL_SIGNAL_THRESHOLD) {
						const loss = lookupAtten(field, wx, wy);
						if (loss > 0) tp *= Math.pow(10, -loss / 20);
					}

					if (ispSpeed > 0 && tp > ispSpeed) tp = ispSpeed;
					if (tp > best) best = tp;
				}

				const ratio = best * invMax;
				const color = ratio <= 0 ? DEAD_COLOR : LUT[Math.min(255, (ratio * 255) | 0)]!;

				const px0 = col * cellSize;
				const px1 = Math.min(px0 + cellSize, width);
				for (let py = py0; py < py1; py++) {
					const rowOff = py * width;
					for (let px = px0; px < px1; px++) {
						u32[rowOff + px] = color;
					}
				}
			}
		}

		const elapsed = performance.now() - t0;
		console.log(
			`[heatmap-worker] ${cols}x${rows} cells, ${n} APs, walls=${!!wallData}: ${elapsed.toFixed(1)}ms`
		);

		(self as unknown as { postMessage(msg: unknown, transfer: Transferable[]): void }).postMessage(
			{ type: 'result', id, buf, width, height },
			[buf]
		);
	}
};
