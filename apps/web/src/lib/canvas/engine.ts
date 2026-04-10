import { Camera } from './camera.js';
import type { Layer, RenderContext } from './types.js';

export class CanvasEngine {
	canvas: HTMLCanvasElement;
	ctx: CanvasRenderingContext2D;
	camera: Camera;
	layers: Layer[] = [];

	private dirty = true;
	private animFrameId = 0;
	private width = 0;
	private height = 0;
	private dpr = 1;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;
		this.camera = new Camera();
		this.dpr = window.devicePixelRatio || 1;
		this.camera.setDpr(this.dpr);
	}

	addLayer(layer: Layer): void {
		this.layers.push(layer);
	}

	removeLayer(id: string): void {
		this.layers = this.layers.filter(l => l.id !== id);
	}

	getLayer(id: string): Layer | undefined {
		return this.layers.find(l => l.id === id);
	}

	markDirty(): void {
		this.dirty = true;
	}

	resize(width: number, height: number): void {
		this.width = width;
		this.height = height;
		this.dpr = window.devicePixelRatio || 1;
		this.camera.setDpr(this.dpr);
		this.canvas.width = width * this.dpr;
		this.canvas.height = height * this.dpr;
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		this.markDirty();
	}

	start(): void {
		const loop = (): void => {
			if (this.dirty) {
				this.render();
				this.dirty = false;
			}
			this.animFrameId = requestAnimationFrame(loop);
		};
		this.animFrameId = requestAnimationFrame(loop);
	}

	stop(): void {
		cancelAnimationFrame(this.animFrameId);
	}

	private render(): void {
		const { ctx, camera, width, height, dpr } = this;
		const rc: RenderContext = { ctx, camera, width, height, dpr };

		// Clear
		ctx.resetTransform();
		ctx.clearRect(0, 0, width * dpr, height * dpr);

		// Render each visible layer
		for (const layer of this.layers) {
			if (layer.visible) {
				ctx.save();
				layer.render(rc);
				ctx.restore();
			}
		}
	}
}
