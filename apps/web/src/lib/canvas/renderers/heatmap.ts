import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/project.svelte.js';
import type { DecodedWallMask } from '../wall-detect.js';
import { computeWallAttenuation } from '../wall-detect.js';
import { WALL_MATERIALS, type WallMaterialId } from '../materials.js';
import { getBaseRate } from '@deconflict/channels';

const CELL_SIZE = 8;

function signalStrength(distance: number, radius: number): number {
	if (distance <= 0) return 1;
	const ratio = distance / radius;
	if (ratio >= 3) return 0;
	return Math.max(0, Math.pow(1 - ratio / 3, 2));
}

function throughputColor(ratio: number): string {
	if (ratio <= 0) return 'rgba(60, 30, 30, 0.45)';
	if (ratio < 0.1) return 'rgba(180, 40, 40, 0.50)';
	if (ratio < 0.3) return 'rgba(220, 120, 20, 0.45)';
	if (ratio < 0.55) return 'rgba(210, 190, 30, 0.40)';
	if (ratio < 0.8) return 'rgba(100, 180, 80, 0.35)';
	return 'rgba(40, 150, 40, 0.35)';
}

export class HeatmapLayer implements Layer {
	id = 'heatmap';
	visible = false;
	aps: AccessPoint[] = [];
	ispSpeed = 0;
	wallMask: DecodedWallMask | null = null;
	wallAttenuation = 5; // legacy fallback
	materialMap: Uint8Array | null = null;
	materialVersion = 0; // incremented on any material change
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
						`${ap.id}:${Math.round(ap.x)}:${Math.round(ap.y)}:${ap.interferenceRadius}:${ap.band}:${ap.channelWidth}:${ap.assignedChannel}`
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
		camera: { screenToWorld: (p: { x: number; y: number }) => { x: number; y: number } }
	): HTMLCanvasElement {
		const offscreen = document.createElement('canvas');
		offscreen.width = width;
		offscreen.height = height;
		const ctx = offscreen.getContext('2d')!;

		const cellSize = CELL_SIZE;
		const cols = Math.ceil(width / cellSize);
		const rows = Math.ceil(height / cellSize);

		let maxThroughput = 0;
		for (const ap of this.aps) {
			const base = getBaseRate(ap.band, ap.channelWidth) * 0.5;
			if (base > maxThroughput) maxThroughput = base;
		}
		if (this.ispSpeed > 0 && this.ispSpeed < maxThroughput) {
			maxThroughput = this.ispSpeed;
		}
		if (maxThroughput <= 0) maxThroughput = 100;

		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const screenX = col * cellSize + cellSize / 2;
				const screenY = row * cellSize + cellSize / 2;
				const worldPoint = camera.screenToWorld({ x: screenX, y: screenY });

				let bestSignal = 0;
				let bestAp: AccessPoint | null = null;

				for (const ap of this.aps) {
					const dx = worldPoint.x - ap.x;
					const dy = worldPoint.y - ap.y;
					const dist = Math.sqrt(dx * dx + dy * dy);
					const signal = signalStrength(dist, ap.interferenceRadius);
					if (signal > bestSignal) {
						bestSignal = signal;
						bestAp = ap;
					}
				}

				if (bestAp && bestSignal > 0.001) {
					const base = getBaseRate(bestAp.band, bestAp.channelWidth) * 0.5;
					let throughput = base * bestSignal;

					// Wall attenuation via ray marching with per-material dB values
					if (this.wallMask) {
						const defaultDb =
							WALL_MATERIALS[this.defaultMaterial]?.attenuation ?? this.wallAttenuation;
						const wallLoss = computeWallAttenuation(
							this.wallMask,
							this.materialMap,
							WALL_MATERIALS,
							defaultDb,
							bestAp.x,
							bestAp.y,
							worldPoint.x,
							worldPoint.y
						);
						if (wallLoss > 0) {
							throughput *= Math.pow(10, -wallLoss / 20);
						}
					}

					if (this.ispSpeed > 0) {
						throughput = Math.min(throughput, this.ispSpeed);
					}
					const ratio = throughput / maxThroughput;
					ctx.fillStyle = throughputColor(ratio);
				} else {
					ctx.fillStyle = 'rgba(60, 30, 30, 0.45)';
				}

				ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
			}
		}

		return offscreen;
	}
}
