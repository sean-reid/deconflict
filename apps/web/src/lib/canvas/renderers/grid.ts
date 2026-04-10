import type { Layer, RenderContext } from '../types.js';

const MINOR_SPACING = 20;
const MAJOR_SPACING = 100;
const MINOR_COLOR = '#1a1d27'; // --canvas-grid
const MAJOR_COLOR = '#252838'; // --canvas-grid-major

export class GridLayer implements Layer {
	id = 'grid';
	visible = true;

	render(rc: RenderContext): void {
		const { ctx, camera, width, height, dpr } = rc;
		const transform = camera.getTransform();
		const zoom = camera.state.zoom;

		// Don't render minor grid when zoomed out too far
		const showMinor = zoom >= 0.5;

		// Calculate visible bounds in world space
		const topLeft = camera.screenToWorld({ x: 0, y: 0 });
		const bottomRight = camera.screenToWorld({ x: width, y: height });

		// Determine grid spacing based on zoom
		const minor = MINOR_SPACING;
		const major = MAJOR_SPACING;

		// Snap to grid boundaries
		const startX = Math.floor(topLeft.x / minor) * minor;
		const endX = Math.ceil(bottomRight.x / minor) * minor;
		const startY = Math.floor(topLeft.y / minor) * minor;
		const endY = Math.ceil(bottomRight.y / minor) * minor;

		// Apply camera transform
		const [a, b, c, d, e, f] = transform;
		ctx.setTransform(a, b, c, d, e, f);

		ctx.lineWidth = 1 / (zoom * dpr);

		// Minor grid lines
		if (showMinor) {
			ctx.strokeStyle = MINOR_COLOR;
			ctx.beginPath();
			for (let x = startX; x <= endX; x += minor) {
				if (x % major === 0) continue;
				ctx.moveTo(x, startY);
				ctx.lineTo(x, endY);
			}
			for (let y = startY; y <= endY; y += minor) {
				if (y % major === 0) continue;
				ctx.moveTo(startX, y);
				ctx.lineTo(endX, y);
			}
			ctx.stroke();
		}

		// Major grid lines
		ctx.strokeStyle = MAJOR_COLOR;
		ctx.beginPath();
		const majorStartX = Math.floor(topLeft.x / major) * major;
		const majorEndX = Math.ceil(bottomRight.x / major) * major;
		const majorStartY = Math.floor(topLeft.y / major) * major;
		const majorEndY = Math.ceil(bottomRight.y / major) * major;

		for (let x = majorStartX; x <= majorEndX; x += major) {
			ctx.moveTo(x, majorStartY);
			ctx.lineTo(x, majorEndY);
		}
		for (let y = majorStartY; y <= majorEndY; y += major) {
			ctx.moveTo(majorStartX, y);
			ctx.lineTo(majorEndX, y);
		}
		ctx.stroke();
	}
}
