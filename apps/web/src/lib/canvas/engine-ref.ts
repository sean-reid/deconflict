import type { CanvasEngine } from './engine.js';

let engineRef: CanvasEngine | null = null;

export function setEngineRef(engine: CanvasEngine): void {
	engineRef = engine;
}

export function getEngineRef(): CanvasEngine | null {
	return engineRef;
}
