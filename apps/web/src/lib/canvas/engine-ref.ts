import type { CanvasEngine } from './engine.js';
import type { WallMaterialId } from './materials.js';

let engineRef: CanvasEngine | null = null;
let onMaterialChange: ((id: WallMaterialId) => void) | null = null;

export function setEngineRef(engine: CanvasEngine): void {
	engineRef = engine;
}

export function getEngineRef(): CanvasEngine | null {
	return engineRef;
}

/** Register a callback for when global wall material changes.
 *  Called by CanvasView to wire the renderer update. */
export function setMaterialChangeHandler(fn: (id: WallMaterialId) => void): void {
	onMaterialChange = fn;
}

/** Notify renderers that the default wall material changed. */
export function notifyMaterialChange(id: WallMaterialId): void {
	onMaterialChange?.(id);
}
