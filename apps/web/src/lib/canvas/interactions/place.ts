import type { CanvasEngine } from '../engine.js';
import { addAp } from '$state/project.svelte.js';
import { selectAp } from '$state/canvas.svelte.js';
import { appState } from '$state/app.svelte.js';

export class PlaceHandler {
	private engine: CanvasEngine;

	constructor(engine: CanvasEngine) {
		this.engine = engine;
	}

	handlePointerDown(e: PointerEvent): void {
		if (e.button !== 0) return;

		const rect = this.engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const worldPoint = this.engine.camera.screenToWorld(screenPoint);

		const ap = addAp(worldPoint.x, worldPoint.y);
		selectAp(ap.id);
		appState.sidebarPanel = 'aps';
		this.engine.markDirty();
	}
}
