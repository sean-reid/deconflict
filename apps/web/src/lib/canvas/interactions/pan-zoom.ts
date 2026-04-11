import type { CanvasEngine } from '../engine.js';

export class PanZoomHandler {
	private engine: CanvasEngine;
	private isPanning = false;
	private lastX = 0;
	private lastY = 0;

	// Touch pinch-zoom state
	private lastPinchDist = 0;
	private lastPinchCenter = { x: 0, y: 0 };
	private pinchStarted = false;

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
			const t0 = e.touches[0]!;
			const t1 = e.touches[1]!;
			this.lastPinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
			this.lastPinchCenter = {
				x: (t0.clientX + t1.clientX) / 2,
				y: (t0.clientY + t1.clientY) / 2
			};
			this.isPanning = true;
			this.pinchStarted = false; // skip the first move to avoid jump
			this.lastX = this.lastPinchCenter.x;
			this.lastY = this.lastPinchCenter.y;
		}
	};

	private onTouchMove = (e: TouchEvent): void => {
		if (e.touches.length === 2) {
			e.preventDefault();
			const t0 = e.touches[0]!;
			const t1 = e.touches[1]!;

			const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
			const center = {
				x: (t0.clientX + t1.clientX) / 2,
				y: (t0.clientY + t1.clientY) / 2
			};

			if (!this.pinchStarted) {
				// First move after pinch start: just record positions, don't apply
				// This prevents the initial jump from finger settling
				this.pinchStarted = true;
				this.lastPinchDist = dist;
				this.lastX = center.x;
				this.lastY = center.y;
				return;
			}

			// Pinch zoom
			if (this.lastPinchDist > 0) {
				const factor = dist / this.lastPinchDist;
				// Clamp to prevent extreme jumps
				const clampedFactor = Math.max(0.8, Math.min(1.2, factor));
				const rect = this.engine.canvas.getBoundingClientRect();
				const screenPoint = { x: center.x - rect.left, y: center.y - rect.top };
				this.engine.camera.zoomAt(screenPoint, clampedFactor);
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
		this.pinchStarted = false;
	};
}
