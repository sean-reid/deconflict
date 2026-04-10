import type { CanvasEngine } from '../engine.js';
import type { SelectionRectLayer } from '../renderers/selection-rect.js';
import { hitTest } from '../hit-test.js';
import { projectState } from '$state/project.svelte.js';
import { canvasState, selectAp, selectAps, clearSelection } from '$state/canvas.svelte.js';

export class SelectHandler {
	private engine: CanvasEngine;
	private selectionRectLayer: SelectionRectLayer;
	private isBoxSelecting = false;
	private boxStart = { x: 0, y: 0 };

	constructor(engine: CanvasEngine, selectionRectLayer: SelectionRectLayer) {
		this.engine = engine;
		this.selectionRectLayer = selectionRectLayer;
	}

	handlePointerDown(e: PointerEvent): boolean {
		const rect = this.engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const hit = hitTest(screenPoint, this.engine.camera, projectState.aps);

		if (hit) {
			selectAp(hit.id, e.shiftKey);
			this.engine.markDirty();
			return true;
		} else if (!e.shiftKey) {
			// Start box selection on empty canvas
			const worldPoint = this.engine.camera.screenToWorld(screenPoint);
			this.isBoxSelecting = true;
			this.boxStart = worldPoint;
			this.selectionRectLayer.active = true;
			this.selectionRectLayer.startX = worldPoint.x;
			this.selectionRectLayer.startY = worldPoint.y;
			this.selectionRectLayer.endX = worldPoint.x;
			this.selectionRectLayer.endY = worldPoint.y;
			clearSelection();
			this.engine.markDirty();
		}
		return false;
	}

	handlePointerMove(e: PointerEvent): void {
		const rect = this.engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };

		if (this.isBoxSelecting) {
			const worldPoint = this.engine.camera.screenToWorld(screenPoint);
			this.selectionRectLayer.endX = worldPoint.x;
			this.selectionRectLayer.endY = worldPoint.y;
			this.engine.markDirty();
			return;
		}

		const hit = hitTest(screenPoint, this.engine.camera, projectState.aps);
		const newHoveredId = hit ? hit.id : null;

		if (newHoveredId !== canvasState.hoveredApId) {
			canvasState.hoveredApId = newHoveredId;
			this.engine.markDirty();
		}
	}

	handlePointerUp(_e: PointerEvent): void {
		if (!this.isBoxSelecting) return;

		const minX = Math.min(this.selectionRectLayer.startX, this.selectionRectLayer.endX);
		const maxX = Math.max(this.selectionRectLayer.startX, this.selectionRectLayer.endX);
		const minY = Math.min(this.selectionRectLayer.startY, this.selectionRectLayer.endY);
		const maxY = Math.max(this.selectionRectLayer.startY, this.selectionRectLayer.endY);

		const selected = projectState.aps
			.filter((ap) => ap.x >= minX && ap.x <= maxX && ap.y >= minY && ap.y <= maxY)
			.map((ap) => ap.id);

		selectAps(selected);
		this.selectionRectLayer.active = false;
		this.isBoxSelecting = false;
		this.engine.markDirty();
	}
}
