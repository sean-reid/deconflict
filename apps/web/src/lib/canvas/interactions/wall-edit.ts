import type { CanvasEngine } from '../engine.js';
import type { WallMaterialId } from '../materials.js';
import { appState } from '$state/app.svelte.js';

export class WallEditHandler {
	private engine: CanvasEngine;
	private painting = false;
	private lastX = 0;
	private lastY = 0;

	// Set externally by CanvasView with the live decoded mask data
	wallData: Uint8Array | null = null;
	materialData: Uint8Array | null = null;
	maskWidth = 0;
	maskHeight = 0;
	activeMaterial: WallMaterialId = 0;
	defaultMaterial: WallMaterialId = 0;

	// Called after edits to update renderers
	onEdit: (() => void) | null = null;

	constructor(engine: CanvasEngine) {
		this.engine = engine;
	}

	handlePointerDown(e: PointerEvent): void {
		if (!appState.wallEditMode || !this.wallData) return;
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
		if (!this.painting || !this.wallData) return;
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
		const { wallData, maskWidth: w, maskHeight: h } = this;
		if (!wallData) return;

		const r = appState.wallBrushSize;
		const cx = Math.round(wx);
		const cy = Math.round(wy);
		const mode = appState.wallEditMode;

		const xlo = Math.max(0, cx - r);
		const xhi = Math.min(w - 1, cx + r);
		const ylo = Math.max(0, cy - r);
		const yhi = Math.min(h - 1, cy + r);
		const r2 = r * r;

		for (let y = ylo; y <= yhi; y++) {
			for (let x = xlo; x <= xhi; x++) {
				if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r2) continue;
				const idx = y * w + x;

				if (mode === 'erase') {
					wallData[idx] = 0;
				} else if (mode === 'draw') {
					wallData[idx] = 1;
				} else if (mode === 'material') {
					// Only paint material on existing wall pixels
					if (wallData[idx]) {
						if (!this.materialData) {
							this.materialData = new Uint8Array(w * h);
							// Fill with current default material, not zeros (which = Drywall)
							this.materialData.fill(this.defaultMaterial);
						}
						this.materialData[idx] = this.activeMaterial;
					}
				}
			}
		}

		this.onEdit?.();
		this.engine.markDirty();
	}
}
