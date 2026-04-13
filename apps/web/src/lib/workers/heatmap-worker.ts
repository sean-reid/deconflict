/// <reference lib="webworker" />

/**
 * Heatmap Web Worker — generates signal coverage maps off the main thread.
 * Uses shared RF propagation module for signal model + wall attenuation.
 */

import {
	signalPower,
	getBaseRate,
	getAttenField,
	lookupAtten,
	invalidateAttenCache
} from '../rf/propagation.js';

const CELL_SIZE = 6;
const MAX_RATIO_SQ = 4;
const WALL_SIGNAL_THRESHOLD = 0.05;

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

// --- Worker state ---

let wallData: Uint8Array | null = null;
let wallW = 0;
let wallH = 0;
let materialMap: Uint8Array | null = null;
let materialDb: number[] = [];
let defaultDb = 5;

// --- Message types ---

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
		invalidateAttenCache();
		return;
	}

	if (msg.type === 'render') {
		const { id, aps, ispSpeed, cameraInverse: inv, viewWidth: width, viewHeight: height } = msg;
		const cellSize = CELL_SIZE;
		const cols = Math.ceil(width / cellSize);
		const rows = Math.ceil(height / cellSize);

		let maxTp = 0;
		for (const ap of aps) {
			const base = getBaseRate(ap.band, ap.channelWidth) * 0.5;
			if (base > maxTp) maxTp = base;
		}
		if (ispSpeed > 0 && ispSpeed < maxTp) maxTp = ispSpeed;
		if (maxTp <= 0) maxTp = 100;
		const invMax = 1 / maxTp;

		const n = aps.length;
		const apX = new Float64Array(n);
		const apY = new Float64Array(n);
		const apRadSq = new Float64Array(n);
		const apCutSq = new Float64Array(n);
		const apBase = new Float64Array(n);
		const attenFields = [];
		for (let i = 0; i < n; i++) {
			const ap = aps[i]!;
			apX[i] = ap.x;
			apY[i] = ap.y;
			const rSq = ap.interferenceRadius * ap.interferenceRadius;
			apRadSq[i] = rSq;
			apCutSq[i] = rSq * MAX_RATIO_SQ;
			apBase[i] = getBaseRate(ap.band, ap.channelWidth) * 0.5;
			attenFields.push(
				wallData
					? getAttenField(
							ap.x,
							ap.y,
							ap.interferenceRadius,
							wallData,
							wallW,
							wallH,
							materialMap,
							materialDb,
							defaultDb
						)
					: null
			);
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

		(self as unknown as { postMessage(msg: unknown, transfer: Transferable[]): void }).postMessage(
			{ type: 'result', id, buf, width, height },
			[buf]
		);
	}
};
