import type { CanvasEngine } from '../engine.js';
import { hitTest } from '../hit-test.js';
import { projectState, moveAp, beginMove } from '$state/project.svelte.js';
import { canvasState, isSelected } from '$state/canvas.svelte.js';

export class DragHandler {
	private engine: CanvasEngine;
	private _isDragging = false;
	private dragApId: string | null = null;
	private startWorld = { x: 0, y: 0 };
	private apStartPositions: Map<string, { x: number; y: number }> = new Map();

	constructor(engine: CanvasEngine) {
		this.engine = engine;
	}

	handlePointerDown(e: PointerEvent): boolean {
		const rect = this.engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const hit = hitTest(screenPoint, this.engine.camera, projectState.aps);

		if (hit && isSelected(hit.id)) {
			beginMove();
			this._isDragging = true;
			this.dragApId = hit.id;
			canvasState.isDragging = true;
			this.startWorld = this.engine.camera.screenToWorld(screenPoint);

			// Store start positions of all selected APs
			this.apStartPositions.clear();
			for (const id of canvasState.selectedApIds) {
				const ap = projectState.aps.find(a => a.id === id);
				if (ap) {
					this.apStartPositions.set(id, { x: ap.x, y: ap.y });
				}
			}
			return true;
		}
		return false;
	}

	handlePointerMove(e: PointerEvent): void {
		if (!this._isDragging) return;

		const rect = this.engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const worldPoint = this.engine.camera.screenToWorld(screenPoint);

		const dx = worldPoint.x - this.startWorld.x;
		const dy = worldPoint.y - this.startWorld.y;

		// Move all selected APs by the delta
		for (const [id, start] of this.apStartPositions) {
			moveAp(id, start.x + dx, start.y + dy);
		}

		this.engine.markDirty();
	}

	handlePointerUp(): void {
		if (this._isDragging) {
			this._isDragging = false;
			this.dragApId = null;
			canvasState.isDragging = false;
			this.apStartPositions.clear();
		}
	}

	get isDragging(): boolean {
		return this._isDragging;
	}
}
