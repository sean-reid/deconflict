import type { Camera } from './camera.js';

export interface RenderContext {
	ctx: CanvasRenderingContext2D;
	camera: Camera;
	width: number;
	height: number;
	dpr: number;
}

export interface Layer {
	id: string;
	visible: boolean;
	render(rc: RenderContext): void;
}
