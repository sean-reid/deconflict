import type { Point, Matrix2D } from '@deconflict/geometry';
import { identity, translate, scale, invert, applyToPoint } from '@deconflict/geometry';

export interface CameraState {
	x: number; // pan offset in world coords
	y: number;
	zoom: number; // scale factor (1.0 = 100%)
}

export class Camera {
	state: CameraState = { x: 0, y: 0, zoom: 1 };

	private dpr = 1;

	setDpr(dpr: number): void {
		this.dpr = dpr;
	}

	/** Get the world-to-screen transform matrix */
	getTransform(): Matrix2D {
		let m = identity();
		m = scale(m, this.state.zoom * this.dpr, this.state.zoom * this.dpr);
		m = translate(m, this.state.x, this.state.y);
		return m;
	}

	/** Get screen-to-world transform (inverse) */
	getInverseTransform(): Matrix2D {
		return invert(this.getTransform());
	}

	/** Convert screen coordinates to world coordinates */
	screenToWorld(screen: Point): Point {
		return applyToPoint(this.getInverseTransform(), screen);
	}

	/** Convert world coordinates to screen coordinates */
	worldToScreen(world: Point): Point {
		return applyToPoint(this.getTransform(), world);
	}

	pan(dx: number, dy: number): void {
		this.state.x += dx;
		this.state.y += dy;
	}

	/** Zoom centered on a screen-space point */
	zoomAt(screenPoint: Point, factor: number): void {
		const worldBefore = this.screenToWorld(screenPoint);
		this.state.zoom = Math.max(0.1, Math.min(10, this.state.zoom * factor));
		const worldAfter = this.screenToWorld(screenPoint);
		this.state.x += worldAfter.x - worldBefore.x;
		this.state.y += worldAfter.y - worldBefore.y;
	}

	reset(): void {
		this.state = { x: 0, y: 0, zoom: 1 };
	}

	getZoomPercent(): number {
		return Math.round(this.state.zoom * 100);
	}
}
