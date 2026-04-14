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

	/** Grow the mask to include the given world coordinate + brush radius. */
	private growMask(cx: number, cy: number, r: number): void {
		const oldW = this.maskWidth;
		const oldH = this.maskHeight;
		// New bounds: union of existing mask and brush area, with 500px padding
		const pad = 500;
		const newW = Math.max(oldW, cx + r + pad);
		const newH = Math.max(oldH, cy + r + pad);
		if (newW <= oldW && newH <= oldH) return;

		const w = Math.ceil(newW);
		const h = Math.ceil(newH);
		const newWall = new Uint8Array(w * h);
		const newMat = this.materialData ? new Uint8Array(w * h) : null;
		if (newMat) newMat.fill(this.defaultMaterial);

		// Copy old data
		for (let y = 0; y < oldH; y++) {
			const srcOff = y * oldW;
			const dstOff = y * w;
			newWall.set(this.wallData!.subarray(srcOff, srcOff + oldW), dstOff);
			if (newMat && this.materialData) {
				newMat.set(this.materialData.subarray(srcOff, srcOff + oldW), dstOff);
			}
		}

		this.wallData = newWall;
		this.materialData = newMat;
		this.maskWidth = w;
		this.maskHeight = h;
	}

	private paintAt(wx: number, wy: number): void {
		if (!this.wallData) return;

		const r = appState.wallBrushSize;
		const cx = Math.round(wx);
		const cy = Math.round(wy);
		const mode = appState.wallEditMode;

		// Grow mask if painting outside current bounds
		if (cx + r >= this.maskWidth || cy + r >= this.maskHeight) {
			this.growMask(cx, cy, r);
		}
		// Skip negative coordinates (can't grow leftward without re-mapping all pixels)
		if (cx - r < 0 || cy - r < 0) return;

		const w = this.maskWidth;
		const h = this.maskHeight;
		const wallData = this.wallData;

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
					// New wall pixels get the active material from the toolbar
					if (!this.materialData) {
						this.materialData = new Uint8Array(w * h);
						this.materialData.fill(this.defaultMaterial);
					}
					this.materialData[idx] = this.activeMaterial;
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
