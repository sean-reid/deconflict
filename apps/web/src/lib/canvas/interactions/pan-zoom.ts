import type { CanvasEngine } from '../engine.js';
import { appState } from '$state/app.svelte.js';

export class PanZoomHandler {
	private engine: CanvasEngine;
	private isPanning = false;
	private lastX = 0;
	private lastY = 0;
	private spaceHeld = false;

	// Touch pinch-zoom state
	private lastPinchDist = 0;
	private lastPinchCenter = { x: 0, y: 0 };

	constructor(engine: CanvasEngine) {
		this.engine = engine;
	}

	attach(): void {
		const canvas = this.engine.canvas;
		canvas.addEventListener('wheel', this.onWheel, { passive: false });
		canvas.addEventListener('pointerdown', this.onPointerDown);
		canvas.addEventListener('pointermove', this.onPointerMove);
		canvas.addEventListener('pointerup', this.onPointerUp);
		canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
		canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
		canvas.addEventListener('touchend', this.onTouchEnd);
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
	}

	detach(): void {
		const canvas = this.engine.canvas;
		canvas.removeEventListener('wheel', this.onWheel);
		canvas.removeEventListener('pointerdown', this.onPointerDown);
		canvas.removeEventListener('pointermove', this.onPointerMove);
		canvas.removeEventListener('pointerup', this.onPointerUp);
		canvas.removeEventListener('touchstart', this.onTouchStart);
		canvas.removeEventListener('touchmove', this.onTouchMove);
		canvas.removeEventListener('touchend', this.onTouchEnd);
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
		// Middle mouse button, space held, or pan tool active
		const isPanTool = appState.activeTool === 'pan';
		if (e.button === 1 || (e.button === 0 && (this.spaceHeld || isPanTool))) {
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
			const isPanTool = appState.activeTool === 'pan';
			this.engine.canvas.style.cursor = isPanTool ? 'grab' : '';
		}
	};

	// Touch: two-finger pan and pinch-zoom
	private onTouchStart = (e: TouchEvent): void => {
		if (e.touches.length === 2) {
			e.preventDefault();
			const t0 = e.touches[0]!;
			const t1 = e.touches[1]!;
			this.lastPinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
			this.lastPinchCenter = {
				x: (t0.clientX + t1.clientX) / 2,
				y: (t0.clientY + t1.clientY) / 2
			};
			this.isPanning = true;
			this.lastX = this.lastPinchCenter.x;
			this.lastY = this.lastPinchCenter.y;
		}
	};

	private onTouchMove = (e: TouchEvent): void => {
		if (e.touches.length === 2) {
			e.preventDefault();
			const t0 = e.touches[0]!;
			const t1 = e.touches[1]!;

			// Pinch zoom
			const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
			const center = {
				x: (t0.clientX + t1.clientX) / 2,
				y: (t0.clientY + t1.clientY) / 2
			};

			if (this.lastPinchDist > 0) {
				const factor = dist / this.lastPinchDist;
				const rect = this.engine.canvas.getBoundingClientRect();
				const screenPoint = { x: center.x - rect.left, y: center.y - rect.top };
				this.engine.camera.zoomAt(screenPoint, factor);
			}

			// Two-finger pan
			const dx = (center.x - this.lastX) / this.engine.camera.state.zoom;
			const dy = (center.y - this.lastY) / this.engine.camera.state.zoom;
			this.engine.camera.pan(dx, dy);

			this.lastPinchDist = dist;
			this.lastPinchCenter = center;
			this.lastX = center.x;
			this.lastY = center.y;
			this.engine.markDirty();
		}
	};

	private onTouchEnd = (_e: TouchEvent): void => {
		this.lastPinchDist = 0;
		this.isPanning = false;
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
