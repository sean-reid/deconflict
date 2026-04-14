import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/ap-state.svelte.js';

/** AP with optional cross-floor parameters for 3D propagation. */
type HeatmapAp = AccessPoint & {
	verticalOffset?: number; // meters — ceiling height × floor distance
	floorDbPerMeter?: number; // dB/m through the slab material
	floorThickness?: number; // slab thickness in meters
};
import type { DecodedWallMask } from '../wall-detect.js';
import type { WallMaterialId } from '../materials.js';
import { WALL_MATERIALS } from '../materials.js';
import {
	signalPower,
	getBaseRate,
	getAttenField,
	lookupAtten,
	invalidateAttenCache,
	type AttenField
} from '../../rf/propagation.js';

const CELL_SIZE = 6;

// Color LUT — 256 entries, built once
const STOPS: [number, number, number, number, number][] = [
	[0.0, 100, 35, 35, 0],
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
// LUT[0] must be exactly 0 so the `!color` skip works for transparent pixels
LUT[0] = 0;

/**
 * Heatmap layer — synchronous main-thread rendering.
 *
 * Wall attenuation uses precomputed fields from rf/propagation.ts (O(1) lookup).
 * No Web Worker, no async state. Renders in the same frame as everything else.
 * Typical render time: 2-7ms (well within 16ms frame budget).
 */
export class HeatmapLayer implements Layer {
	id = 'heatmap';
	visible = false;
	aps: HeatmapAp[] = [];
	ispSpeed = 0;
	wallMask: DecodedWallMask | null = null;
	wallAttenuation = 5;
	materialMap: Uint8Array | null = null;
	materialVersion = 0;
	defaultMaterial: WallMaterialId = 0;
	isDragging = false;
	worldUnitsPerMeter = 32.8; // updated from getEffectiveWupm()

	private cache: HTMLCanvasElement | null = null;
	private cacheKey = '';

	markWallsDirty(): void {
		this.cacheKey = '';
		invalidateAttenCache();
	}

	render(rc: RenderContext): void {
		if (this.aps.length === 0) return;
		const { camera, width, height } = rc;
		if (width <= 0 || height <= 0) return;

		const key = this.getCacheKey(camera, width, height);
		if (key !== this.cacheKey) {
			this.cacheKey = key;
			this.cache = this.generate(width, height, camera);
		}

		if (this.cache) {
			rc.compositeOffscreen(this.cache);
		}
	}

	private getCacheKey(
		camera: { state: { zoom: number; x: number; y: number } },
		width: number,
		height: number
	): string {
		return (
			this.aps
				.map(
					(ap) =>
						`${ap.id}:${Math.round(ap.x)}:${Math.round(ap.y)}:${ap.interferenceRadius}:${ap.band}:${ap.channelWidth}:${ap.assignedChannel}:${ap.power}:${ap.verticalOffset ?? 0}:${ap.floorDbPerMeter ?? 0}:${ap.floorThickness ?? 0}`
				)
				.join('|') +
			`|isp:${this.ispSpeed}|wm:${this.wallMask?.width ?? 0}|mat:${this.defaultMaterial}|mv:${this.materialVersion}` +
			`|z:${camera.state.zoom.toFixed(3)}:x:${Math.round(camera.state.x * 10)}:y:${Math.round(camera.state.y * 10)}` +
			`|${width}x${height}`
		);
	}

	private generate(
		width: number,
		height: number,
		camera: { getInverseTransform: () => number[] }
	): HTMLCanvasElement {
		const offscreen = document.createElement('canvas');
		offscreen.width = width;
		offscreen.height = height;
		const ctx = offscreen.getContext('2d')!;
		const cellSize = CELL_SIZE;
		const cols = Math.ceil(width / cellSize);
		const rows = Math.ceil(height / cellSize);

		let maxTp = 0;
		for (const ap of this.aps) {
			const base = getBaseRate(ap.band, ap.channelWidth) * 0.5;
			if (base > maxTp) maxTp = base;
		}
		if (this.ispSpeed > 0 && this.ispSpeed < maxTp) maxTp = this.ispSpeed;
		if (maxTp <= 0) maxTp = 100;
		const invMax = 1 / maxTp;

		const n = this.aps.length;
		const apX = new Float64Array(n);
		const apY = new Float64Array(n);
		const apRadSq = new Float64Array(n);
		const apBase = new Float64Array(n);
		const wupm = this.worldUnitsPerMeter;
		const wupmSq = wupm * wupm;
		const defaultDb = WALL_MATERIALS[this.defaultMaterial]?.attenuation ?? this.wallAttenuation;
		const matDb = WALL_MATERIALS.map((m) => m.dbPerMeter * m.typicalThickness);
		const fast = this.isDragging;

		// Per-AP cross-floor parameters
		const vertOffSq = new Float64Array(n); // vertical offset² in world units²
		const floorDbThickness = new Float64Array(n); // ITU aggregate floor isolation (dB)

		const fields: (AttenField | null)[] = [];
		for (let i = 0; i < n; i++) {
			const ap = this.aps[i]!;
			apX[i] = ap.x;
			apY[i] = ap.y;
			const vo = ap.verticalOffset ?? 0;
			vertOffSq[i] = vo * vo * wupmSq;
			floorDbThickness[i] = (ap.floorDbPerMeter ?? 0) * (ap.floorThickness ?? 0);
			const rSq = ap.interferenceRadius * ap.interferenceRadius;
			apRadSq[i] = rSq;
			apBase[i] = getBaseRate(ap.band, ap.channelWidth) * 0.5;
			fields.push(
				this.wallMask
					? getAttenField(
							ap.x,
							ap.y,
							ap.interferenceRadius,
							this.wallMask.data,
							this.wallMask.width,
							this.wallMask.height,
							this.materialMap,
							matDb,
							defaultDb,
							fast,
							this.wallMask.originX,
							this.wallMask.originY
						)
					: null
			);
		}

		const inv = camera.getInverseTransform();
		const ia = inv[0]!,
			ib = inv[1]!,
			ic = inv[2]!,
			idd = inv[3]!,
			ie = inv[4]!,
			ig = inv[5]!;

		const imgData = ctx.createImageData(width, height);
		const u32 = new Uint32Array(imgData.data.buffer);
		const ispCap = this.ispSpeed;

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
					const dSq = dx * dx + dy * dy + vertOffSq[i]!;
					const signal = signalPower(dSq, apRadSq[i]!);
					let tp = apBase[i]! * signal;

					// Wall attenuation (precomputed field, O(1) lookup)
					const field = fields[i];
					if (field) {
						const loss = lookupAtten(field, wx, wy);
						if (loss > 0) tp *= Math.exp(loss * -0.11512925464);
					}

					// Floor slab attenuation (ITU-R P.1238 empirical model).
					// Uses measured aggregate floor isolation that accounts for
					// direct penetration + diffraction + multipath. Applied as
					// flat dB loss. The 3D distance (via vertOffSq above) already
					// captures the oblique geometry — closer floors = shorter 3D
					// path = stronger signal, steeper angles = longer 3D path.
					const fdt = floorDbThickness[i]!;
					if (fdt > 0) {
						tp *= Math.exp(fdt * -0.11512925464);
					}

					if (ispCap > 0 && tp > ispCap) tp = ispCap;
					if (tp > best) best = tp;
				}

				const ratio = best * invMax;
				const color = ratio <= 0 ? 0 : LUT[Math.min(255, (ratio * 255) | 0)]!;
				if (!color) continue;

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

		ctx.putImageData(imgData, 0, 0);
		return offscreen;
	}
}
