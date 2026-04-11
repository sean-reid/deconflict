import type { CanvasEngine } from '../engine.js';

export class PanZoomHandler {
	private engine: CanvasEngine;
	private isPanning = false;
	private lastX = 0;
	private lastY = 0;

	// Touch pinch-zoom state
	private lastPinchDist = 0;
	private lastPinchCenter = { x: 0, y: 0 };
	private pinchFrameCount = 0;

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
		if (e.button === 1) {
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

	// Touch: two-finger pan and pinch-zoom
	private onTouchStart = (e: TouchEvent): void => {
		if (e.touches.length === 2) {
			e.preventDefault();
			this.isPanning = true;
			this.pinchFrameCount = 0;
			this.lastPinchDist = 0;
		}
	};

	private onTouchMove = (e: TouchEvent): void => {
		if (e.touches.length === 2) {
			e.preventDefault();
			const t0 = e.touches[0]!;
			const t1 = e.touches[1]!;

			const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
			const cx = (t0.clientX + t1.clientX) / 2;
			const cy = (t0.clientY + t1.clientY) / 2;

			this.pinchFrameCount++;

			if (this.pinchFrameCount <= 2) {
				// First two frames: just record baseline, apply nothing
				this.lastPinchDist = dist;
				this.lastX = cx;
				this.lastY = cy;
				return;
			}

			// Pinch zoom
			if (this.lastPinchDist > 0) {
				const factor = dist / this.lastPinchDist;
				if (factor > 0.95 && factor < 1.05) {
					// Ignore micro-jitter
				} else {
					const rect = this.engine.canvas.getBoundingClientRect();
					this.engine.camera.zoomAt({ x: cx - rect.left, y: cy - rect.top }, factor);
				}
			}

			// Two-finger pan
			const dx = (cx - this.lastX) / this.engine.camera.state.zoom;
			const dy = (cy - this.lastY) / this.engine.camera.state.zoom;
			this.engine.camera.pan(dx, dy);

			this.lastPinchDist = dist;
			this.lastX = cx;
			this.lastY = cy;
			this.engine.markDirty();
		}
	};

	private onTouchEnd = (_e: TouchEvent): void => {
		this.lastPinchDist = 0;
		this.isPanning = false;
		this.pinchFrameCount = 0;
	};
}
