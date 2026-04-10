import type { CanvasEngine } from '../engine.js';
import { hitTest } from '../hit-test.js';
import { projectState } from '$state/project.svelte.js';
import { canvasState, selectAp, clearSelection } from '$state/canvas.svelte.js';

export class SelectHandler {
	private engine: CanvasEngine;

	constructor(engine: CanvasEngine) {
		this.engine = engine;
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
			clearSelection();
			this.engine.markDirty();
		}
		return false;
	}

	handlePointerMove(e: PointerEvent): void {
		const rect = this.engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const hit = hitTest(screenPoint, this.engine.camera, projectState.aps);
		const newHoveredId = hit ? hit.id : null;

		if (newHoveredId !== canvasState.hoveredApId) {
			canvasState.hoveredApId = newHoveredId;
			this.engine.markDirty();
		}
	}
}
