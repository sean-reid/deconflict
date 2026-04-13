import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/project.svelte.js';
import type { DecodedWallMask } from '../wall-detect.js';
import { computeWallAttenuation } from '../wall-detect.js';
import { WALL_MATERIALS, type WallMaterialId } from '../materials.js';
import { getBaseRate } from '@deconflict/channels';

const CELL_SIZE = 6;

// Cutoff: at ratio²=4 (dist=2r), signal ≈ 6% — anything beyond is in the dead zone
const MAX_RATIO_SQ = 4;

// Minimum free-space signal worth computing wall attenuation for.
// Below this, the cell is already visually dead-zone regardless of walls.
const WALL_SIGNAL_THRESHOLD = 0.05;

/**
 * Indoor propagation model — inverse quartic falloff.
 * Uses effective path loss exponent n=4 (indoor with moderate obstacles).
 * Computed entirely with multiplication — no sqrt, no division in the ratio.
 * signal = 1 / (1 + (d²/r²)²) = 1 / (1 + d⁴/r⁴)
 */
function signalPower(distSq: number, radiusSq: number): number {
	const ratioSq = distSq / radiusSq;
	return 1 / (1 + ratioSq * ratioSq);
}

// Color stops: [threshold, r, g, b, alpha (0-255)]
const STOPS: [number, number, number, number, number][] = [
	[0.0, 180, 40, 40, 128],
	[0.15, 220, 120, 20, 115],
	[0.35, 210, 190, 30, 102],
	[0.55, 130, 190, 60, 94],
	[0.75, 80, 170, 80, 89],
	[1.0, 40, 150, 40, 89]
];

// Precomputed 256-entry RGBA color lookup table
const LUT = new Uint32Array(256);
const DEAD_COLOR = packColor(60, 30, 30, 115);

function packColor(r: number, g: number, b: number, a: number): number {
	// ImageData is always RGBA byte order; Uint32 on little-endian = ABGR
	return ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

(function buildLut() {
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
})();

export class HeatmapLayer implements Layer {
	id = 'heatmap';
	visible = false;
	aps: AccessPoint[] = [];
	ispSpeed = 0;
	wallMask: DecodedWallMask | null = null;
	wallAttenuation = 5;
	materialMap: Uint8Array | null = null;
	materialVersion = 0;
	defaultMaterial: WallMaterialId = 0;
	private cache: HTMLCanvasElement | null = null;
	private cacheKey = '';

	invalidateCache(): void {
		this.cacheKey = '';
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
						`${ap.id}:${Math.round(ap.x)}:${Math.round(ap.y)}:${ap.interferenceRadius}:${ap.band}:${ap.channelWidth}:${ap.assignedChannel}:${ap.power}`
				)
				.join('|') +
			`|isp:${this.ispSpeed}|wm:${this.wallMask ? 1 : 0}|mat:${this.defaultMaterial}|mv:${this.materialVersion}` +
			`|z:${camera.state.zoom.toFixed(3)}:x:${Math.round(camera.state.x * 10)}:y:${Math.round(camera.state.y * 10)}` +
			`|${width}x${height}`
		);
	}

	render(rc: RenderContext): void {
		if (this.aps.length === 0) return;

		const { camera, width, height } = rc;
		const key = this.getCacheKey(camera, width, height);

		if (key !== this.cacheKey || !this.cache) {
			this.cache = this.generateHeatmap(width, height, camera);
			this.cacheKey = key;
		}

		rc.compositeOffscreen(this.cache);
	}

	private generateHeatmap(
		width: number,
		height: number,
		camera: {
			screenToWorld: (p: { x: number; y: number }) => { x: number; y: number };
			getInverseTransform: () => number[];
		}
	): HTMLCanvasElement {
		const t0 = performance.now();

		const offscreen = document.createElement('canvas');
		offscreen.width = width;
		offscreen.height = height;
		const ctx = offscreen.getContext('2d')!;

		const cellSize = CELL_SIZE;
		const cols = Math.ceil(width / cellSize);
		const rows = Math.ceil(height / cellSize);

		// Max throughput for normalization
		let maxThroughput = 0;
		for (const ap of this.aps) {
			const base = getBaseRate(ap.band, ap.channelWidth) * 0.5;
			if (base > maxThroughput) maxThroughput = base;
		}
		if (this.ispSpeed > 0 && this.ispSpeed < maxThroughput) {
			maxThroughput = this.ispSpeed;
		}
		if (maxThroughput <= 0) maxThroughput = 100;
		const invMax = 1 / maxThroughput;

		// Precompute per-AP constants in typed arrays (cache-friendly)
		const n = this.aps.length;
		const apX = new Float64Array(n);
		const apY = new Float64Array(n);
		const apRadSq = new Float64Array(n);
		const apCutSq = new Float64Array(n);
		const apBase = new Float64Array(n);
		for (let i = 0; i < n; i++) {
			const ap = this.aps[i]!;
			apX[i] = ap.x;
			apY[i] = ap.y;
			const rSq = ap.interferenceRadius * ap.interferenceRadius;
			apRadSq[i] = rSq;
			apCutSq[i] = rSq * MAX_RATIO_SQ;
			apBase[i] = getBaseRate(ap.band, ap.channelWidth) * 0.5;
		}

		const defaultDb = WALL_MATERIALS[this.defaultMaterial]?.attenuation ?? this.wallAttenuation;
		const hasWalls = !!this.wallMask;
		const ispCap = this.ispSpeed;

		// Inline camera inverse: [a, b, c, d, e, f]
		// world.x = a*sx + c*sy + e,  world.y = b*sx + d*sy + f
		const inv = camera.getInverseTransform();
		const ia = inv[0]!,
			ib = inv[1]!,
			ic = inv[2]!,
			id = inv[3]!,
			ie = inv[4]!,
			ig = inv[5]!;

		// Allocate ImageData and get a Uint32 view for single-write-per-pixel stamping
		const imgData = ctx.createImageData(width, height);
		const u32 = new Uint32Array(imgData.data.buffer);

		for (let row = 0; row < rows; row++) {
			const sy = row * cellSize + (cellSize >> 1);
			const py0 = row * cellSize;
			const py1 = Math.min(py0 + cellSize, height);

			for (let col = 0; col < cols; col++) {
				const sx = col * cellSize + (cellSize >> 1);

				// Inline screen-to-world
				const wx = ia * sx + ic * sy + ie;
				const wy = ib * sx + id * sy + ig;

				let best = 0;

				for (let i = 0; i < n; i++) {
					const dx = wx - apX[i]!;
					const dy = wy - apY[i]!;
					const dSq = dx * dx + dy * dy;

					// Squared cutoff — no sqrt
					if (dSq > apCutSq[i]!) continue;

					const signal = signalPower(dSq, apRadSq[i]!);
					let tp = apBase[i]! * signal;

					// Only ray-march walls if signal is strong enough to matter visually
					if (hasWalls && signal > WALL_SIGNAL_THRESHOLD) {
						const loss = computeWallAttenuation(
							this.wallMask!,
							this.materialMap,
							WALL_MATERIALS,
							defaultDb,
							apX[i]!,
							apY[i]!,
							wx,
							wy
						);
						if (loss > 0) {
							tp *= Math.pow(10, -loss / 20);
						}
					}

					if (ispCap > 0 && tp > ispCap) tp = ispCap;
					if (tp > best) best = tp;
				}

				// LUT color lookup (single array read, single write per pixel)
				const ratio = best * invMax;
				const color =
					ratio <= 0 ? DEAD_COLOR : LUT[Math.min(255, (ratio * 255) | 0)]!;

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

		const elapsed = performance.now() - t0;
		if (elapsed > 10) {
			console.log(`[heatmap] ${cols}x${rows} cells, ${n} APs, walls=${hasWalls}: ${elapsed.toFixed(1)}ms`);
		}

		return offscreen;
	}
}
