import type { CanvasEngine } from '$canvas/engine.js';
import { projectState } from '$state/project.svelte.js';

export interface PngOptions {
	scale?: number; // resolution multiplier (1, 2, 4). Default 2
	includeGrid?: boolean; // default false for clean export
}

export async function exportPng(engine: CanvasEngine, options: PngOptions = {}): Promise<void> {
	const scale = options.scale ?? 2;
	const includeGrid = options.includeGrid ?? false;

	// Create offscreen canvas
	const offscreen = document.createElement('canvas');
	const width = engine.canvas.width / (window.devicePixelRatio || 1);
	const height = engine.canvas.height / (window.devicePixelRatio || 1);
	offscreen.width = width * scale;
	offscreen.height = height * scale;

	const ctx = offscreen.getContext('2d')!;
	ctx.scale(scale, scale);

	// Fill background
	ctx.fillStyle = '#0a0c12';
	ctx.fillRect(0, 0, width, height);

	// Render selected layers
	const dpr = scale;
	const rc = {
		ctx,
		camera: engine.camera,
		width,
		height,
		dpr,
		compositeOffscreen: (offscreen: HTMLCanvasElement, alpha = 1) => {
			ctx.resetTransform();
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			if (alpha < 1) ctx.globalAlpha = alpha;
			ctx.drawImage(offscreen, 0, 0);
			if (alpha < 1) ctx.globalAlpha = 1;
		}
	};

	for (const layer of engine.layers) {
		if (!layer.visible) continue;
		if (layer.id === 'grid' && !includeGrid) continue;
		if (layer.id === 'selection-rect') continue; // never export selection
		ctx.save();
		layer.render(rc);
		ctx.restore();
	}

	// Convert to blob and download
	return new Promise((resolve) => {
		offscreen.toBlob((blob) => {
			if (!blob) {
				resolve();
				return;
			}
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `${projectState.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.png`;
			a.click();
			URL.revokeObjectURL(url);
			resolve();
		}, 'image/png');
	});
}
