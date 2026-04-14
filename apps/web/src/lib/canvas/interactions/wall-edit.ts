import type { CanvasEngine } from '../engine.js';
import type { WallMaterialId } from '../materials.js';
import { TiledMask } from '../tiled-mask.js';
import { appState } from '$state/app.svelte.js';

export class WallEditHandler {
	private engine: CanvasEngine;
	private painting = false;
	private lastX = 0;
	private lastY = 0;

	/** Tiled mask for infinite-canvas wall drawing. */
	tiledMask: TiledMask | null = null;
	activeMaterial: WallMaterialId = 0;
	defaultMaterial: WallMaterialId = 0;

	// Called after edits to update renderers
	onEdit: (() => void) | null = null;

	constructor(engine: CanvasEngine) {
		this.engine = engine;
	}

	handlePointerDown(e: PointerEvent): void {
		if (!appState.wallEditMode || !this.tiledMask) return;
		this.painting = true;
		const rect = this.engine.canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		const world = this.engine.camera.screenToWorld({ x: sx, y: sy });
		this.lastX = world.x;
		this.lastY = world.y;
		this.paintAt(world.x, world.y);
	}

	handlePointerMove(e: PointerEvent): void {
		if (!this.painting || !this.tiledMask) return;
		const rect = this.engine.canvas.getBoundingClientRect();
		const sx = e.clientX - rect.left;
		const sy = e.clientY - rect.top;
		const world = this.engine.camera.screenToWorld({ x: sx, y: sy });

		// Interpolate between last and current position for smooth strokes
		const dx = world.x - this.lastX;
		const dy = world.y - this.lastY;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const step = Math.max(1, appState.wallBrushSize / 3);
		const steps = Math.ceil(dist / step);

		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			this.paintAt(this.lastX + dx * t, this.lastY + dy * t);
		}

		this.lastX = world.x;
		this.lastY = world.y;
	}

	handlePointerUp(): void {
		this.painting = false;
	}

	private paintAt(wx: number, wy: number): void {
		if (!this.tiledMask) return;

		const r = appState.wallBrushSize;
		const cx = Math.round(wx);
		const cy = Math.round(wy);
		const mode = appState.wallEditMode;
		const mask = this.tiledMask;

		if (mode === 'erase') {
			mask.paintCircle(cx, cy, r, 0);
		} else if (mode === 'draw') {
			mask.paintCircle(cx, cy, r, 1, this.defaultMaterial);
		} else if (mode === 'material') {
			// Only paint material on existing wall pixels
			const x0 = cx - r;
			const y0 = cy - r;
			const x1 = cx + r;
			const y1 = cy + r;
			const r2 = r * r;
			for (let y = y0; y <= y1; y++) {
				for (let x = x0; x <= x1; x++) {
					if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r2) continue;
					if (mask.getPixel(x, y)) {
						mask.setMaterial(x, y, this.activeMaterial);
					}
				}
			}
			mask.markDirty();
		}

		this.onEdit?.();
		this.engine.markDirty();
	}
}
