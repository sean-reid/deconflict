import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/project.svelte.js';
import { getBaseRate } from '@deconflict/channels';

const CELL_SIZE = 8; // pixels per cell at 1x zoom (lower = more detail, slower)

// Simple indoor path loss: signal drops with distance
// Returns a value 0.0 (no signal) to 1.0 (max signal)
function signalStrength(distance: number, radius: number): number {
	if (distance <= 0) return 1;
	if (distance >= radius) return 0;
	// Inverse square-ish falloff, smoothed
	const ratio = distance / radius;
	return Math.max(0, 1 - ratio * ratio);
}

// Map throughput ratio (0-1) to heatmap color
function throughputColor(ratio: number): string {
	if (ratio <= 0) return 'rgba(40, 40, 50, 0.4)'; // dead zone
	if (ratio < 0.15) return `rgba(255, 68, 68, ${0.3 + ratio})`; // red
	if (ratio < 0.4) return `rgba(255, 184, 0, ${0.25 + ratio * 0.5})`; // amber
	if (ratio < 0.7) return `rgba(255, 230, 0, ${0.2 + ratio * 0.3})`; // yellow
	return `rgba(0, 255, 136, ${0.15 + ratio * 0.2})`; // green
}

export class HeatmapLayer implements Layer {
	id = 'heatmap';
	visible = false;
	aps: AccessPoint[] = [];
	ispSpeed = 0;

	// Cache the offscreen canvas
	private cache: HTMLCanvasElement | null = null;
	private cacheKey = '';

	private getCacheKey(camera: { state: { zoom: number; x: number; y: number } }): string {
		return (
			this.aps
				.map(
					(ap) =>
						`${ap.id}:${Math.round(ap.x)}:${Math.round(ap.y)}:${ap.interferenceRadius}:${ap.band}:${ap.channelWidth}:${ap.assignedChannel}`
				)
				.join('|') +
			`|isp:${this.ispSpeed}|zoom:${camera.state.zoom}:x:${Math.round(camera.state.x)}:y:${Math.round(camera.state.y)}`
		);
	}

	render(rc: RenderContext): void {
		if (this.aps.length === 0) return;

		const { ctx, camera, width, height } = rc;
		const key = this.getCacheKey(camera);

		// Regenerate cache if data changed
		if (key !== this.cacheKey || !this.cache) {
			this.cache = this.generateHeatmap(width, height, camera);
			this.cacheKey = key;
		}

		// Draw cached heatmap (in screen space, not world space)
		ctx.resetTransform();
		ctx.drawImage(this.cache, 0, 0);
	}

	private generateHeatmap(width: number, height: number, camera: any): HTMLCanvasElement {
		const offscreen = document.createElement('canvas');
		offscreen.width = width;
		offscreen.height = height;
		const ctx = offscreen.getContext('2d')!;

		const cellSize = CELL_SIZE;
		const cols = Math.ceil(width / cellSize);
		const rows = Math.ceil(height / cellSize);

		// Find max possible throughput for normalization
		let maxThroughput = 0;
		for (const ap of this.aps) {
			const base = getBaseRate(ap.band, ap.channelWidth) * 0.5;
			if (base > maxThroughput) maxThroughput = base;
		}
		if (this.ispSpeed > 0 && this.ispSpeed < maxThroughput) {
			maxThroughput = this.ispSpeed;
		}
		if (maxThroughput <= 0) maxThroughput = 100;

		// For each cell, compute throughput
		for (let row = 0; row < rows; row++) {
			for (let col = 0; col < cols; col++) {
				const screenX = col * cellSize + cellSize / 2;
				const screenY = row * cellSize + cellSize / 2;
				const worldPoint = camera.screenToWorld({ x: screenX, y: screenY });

				// Find signal from each AP at this point
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

				if (bestAp && bestSignal > 0) {
					// Base throughput for this AP
					const base = getBaseRate(bestAp.band, bestAp.channelWidth) * 0.5;

					// Reduce by distance (signal strength)
					let throughput = base * bestSignal;

					// Cap by ISP speed
					if (this.ispSpeed > 0) {
						throughput = Math.min(throughput, this.ispSpeed);
					}

					const ratio = throughput / maxThroughput;
					ctx.fillStyle = throughputColor(ratio);
				} else {
					ctx.fillStyle = 'rgba(40, 40, 50, 0.3)';
				}

				ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
			}
		}

		return offscreen;
	}
}
