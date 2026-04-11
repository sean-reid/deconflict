import type { Layer, RenderContext } from '../types.js';

const MINOR_COLOR = '#1a1d27';
const MAJOR_COLOR = '#252838';
const LABEL_COLOR = '#3a3f52';

export class GridLayer implements Layer {
	id = 'grid';
	visible = true;

	// When set, grid snaps to real-world units
	worldUnitsPerMeter: number | null = null;

	render(rc: RenderContext): void {
		const { ctx, camera, width, height } = rc;
		const transform = camera.getTransform();
		const zoom = camera.state.zoom;

		// Calculate grid spacing
		let minor: number;
		let major: number;
		let unitLabel = '';

		if (this.worldUnitsPerMeter && this.worldUnitsPerMeter > 0) {
			// Calibrated: use metric grid
			const wupm = this.worldUnitsPerMeter;
			minor = wupm; // 1 meter
			major = wupm * 5; // 5 meters
			unitLabel = 'm';

			// If zoomed out a lot, use 5m/25m instead
			const screenMinor = minor * zoom;
			if (screenMinor < 8) {
				minor = wupm * 5;
				major = wupm * 25;
			}
		} else {
			// Uncalibrated: use pixel grid
			minor = 20;
			major = 100;
		}

		const showMinor = zoom >= 0.3;

		const topLeft = camera.screenToWorld({ x: 0, y: 0 });
		const bottomRight = camera.screenToWorld({ x: width, y: height });

		const startX = Math.floor(topLeft.x / minor) * minor;
		const endX = Math.ceil(bottomRight.x / minor) * minor;
		const startY = Math.floor(topLeft.y / minor) * minor;
		const endY = Math.ceil(bottomRight.y / minor) * minor;

		const [a, b, c, d, e, f] = transform;
		ctx.transform(a, b, c, d, e, f);

		ctx.lineWidth = 1 / zoom;

		// Minor grid lines
		if (showMinor) {
			ctx.strokeStyle = MINOR_COLOR;
			ctx.beginPath();
			for (let x = startX; x <= endX; x += minor) {
				if (Math.abs(x % major) < 0.01) continue;
				ctx.moveTo(x, startY);
				ctx.lineTo(x, endY);
			}
			for (let y = startY; y <= endY; y += minor) {
				if (Math.abs(y % major) < 0.01) continue;
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

		// Scale labels on major grid lines (when calibrated)
		if (unitLabel && this.worldUnitsPerMeter) {
			ctx.fillStyle = LABEL_COLOR;
			const fontSize = 10 / zoom;
			ctx.font = `${fontSize}px sans-serif`;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';

			const wupm = this.worldUnitsPerMeter;
			for (let x = majorStartX; x <= majorEndX; x += major) {
				const meters = Math.round(x / wupm);
				if (meters === 0) continue;
				ctx.fillText(`${meters}${unitLabel}`, x + 2 / zoom, topLeft.y + 2 / zoom);
			}
		}
	}
}
