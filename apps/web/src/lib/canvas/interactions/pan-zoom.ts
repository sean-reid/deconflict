import type { CanvasEngine } from '../engine.js';

export class PanZoomHandler {
	private engine: CanvasEngine;
	private isPanning = false;
	private lastX = 0;
	private lastY = 0;
	private spaceHeld = false;

	constructor(engine: CanvasEngine) {
		this.engine = engine;
	}

	attach(): void {
		const canvas = this.engine.canvas;
		canvas.addEventListener('wheel', this.onWheel, { passive: false });
		canvas.addEventListener('pointerdown', this.onPointerDown);
		canvas.addEventListener('pointermove', this.onPointerMove);
		canvas.addEventListener('pointerup', this.onPointerUp);
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
	}

	detach(): void {
		const canvas = this.engine.canvas;
		canvas.removeEventListener('wheel', this.onWheel);
		canvas.removeEventListener('pointerdown', this.onPointerDown);
		canvas.removeEventListener('pointermove', this.onPointerMove);
		canvas.removeEventListener('pointerup', this.onPointerUp);
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);
	}

	private onWheel = (e: WheelEvent): void => {
		e.preventDefault();
		const rect = this.engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		this.engine.camera.zoomAt(screenPoint, factor);
		this.engine.markDirty();
	};

	private onPointerDown = (e: PointerEvent): void => {
		// Middle mouse button or space held
		if (e.button === 1 || (e.button === 0 && this.spaceHeld)) {
			this.isPanning = true;
			this.lastX = e.clientX;
			this.lastY = e.clientY;
			this.engine.canvas.style.cursor = 'grabbing';
			e.preventDefault();
		}
	};

	private onPointerMove = (e: PointerEvent): void => {
		if (!this.isPanning) return;
		const dx = (e.clientX - this.lastX) / this.engine.camera.state.zoom;
		const dy = (e.clientY - this.lastY) / this.engine.camera.state.zoom;
		this.engine.camera.pan(dx, dy);
		this.lastX = e.clientX;
		this.lastY = e.clientY;
		this.engine.markDirty();
	};

	private onPointerUp = (_e: PointerEvent): void => {
		if (this.isPanning) {
			this.isPanning = false;
			this.engine.canvas.style.cursor = '';
		}
	};

	private onKeyDown = (e: KeyboardEvent): void => {
		if (e.code === 'Space' && !e.repeat) {
			this.spaceHeld = true;
			this.engine.canvas.style.cursor = 'grab';
		}
	};

	private onKeyUp = (e: KeyboardEvent): void => {
		if (e.code === 'Space') {
			this.spaceHeld = false;
			if (!this.isPanning) {
				this.engine.canvas.style.cursor = '';
			}
		}
	};
}
