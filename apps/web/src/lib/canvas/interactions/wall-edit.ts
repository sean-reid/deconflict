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

	/** Expand mask if brush reaches beyond current bounds */
	private expandIfNeeded(cx: number, cy: number, r: number): void {
		const margin = r + 50;
		const needX = Math.max(cx + margin, this.maskWidth);
		const needY = Math.max(cy + margin, this.maskHeight);
		const needX0 = Math.min(cx - margin, 0);
		const needY0 = Math.min(cy - margin, 0);

		if (needX <= this.maskWidth && needY <= this.maskHeight && needX0 >= 0 && needY0 >= 0) return;

		const oldW = this.maskWidth;
		const oldH = this.maskHeight;
		const offX = needX0 < 0 ? -needX0 : 0;
		const offY = needY0 < 0 ? -needY0 : 0;
		const newW = Math.max(needX, oldW + offX);
		const newH = Math.max(needY, oldH + offY);

		// Expand wall data
		if (this.wallData) {
			const newWall = new Uint8Array(newW * newH);
			for (let y = 0; y < oldH; y++) {
				for (let x = 0; x < oldW; x++) {
					newWall[(y + offY) * newW + (x + offX)] = this.wallData[y * oldW + x]!;
				}
			}
			this.wallData = newWall;
		}

		// Expand material data
		if (this.materialData) {
			const newMat = new Uint8Array(newW * newH);
			newMat.fill(this.defaultMaterial);
			for (let y = 0; y < oldH; y++) {
				for (let x = 0; x < oldW; x++) {
					newMat[(y + offY) * newW + (x + offX)] = this.materialData[y * oldW + x]!;
				}
			}
			this.materialData = newMat;
		}

		this.maskWidth = newW;
		this.maskHeight = newH;
	}

	private paintAt(wx: number, wy: number): void {
		if (!this.wallData) return;

		const r = appState.wallBrushSize;
		const cx = Math.round(wx);
		const cy = Math.round(wy);
		const mode = appState.wallEditMode;

		// Expand mask if drawing near or beyond edges
		if (mode === 'draw') {
			this.expandIfNeeded(cx, cy, r);
		}

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
					// New wall pixels get the last-used material (not default Drywall)
					if (this.materialData) {
						this.materialData[idx] = this.activeMaterial;
					}
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
