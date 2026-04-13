import type { Layer, RenderContext } from '../types.js';

const MINOR_COLOR = '#1a1d27';
const MAJOR_COLOR = '#252838';
const LABEL_COLOR = '#4d5370';

const FEET_PER_METER = 3.28084;

export class GridLayer implements Layer {
	id = 'grid';
	visible = true;

	// When set, grid snaps to real-world units
	worldUnitsPerMeter: number | null = null;
	unitSystem: 'imperial' | 'metric' = 'imperial';

	render(rc: RenderContext): void {
		const { ctx, camera, width, height } = rc;
		const transform = camera.getTransform();
		const zoom = camera.state.zoom;

		// Calculate grid spacing
		let minor: number;
		let major: number;
		let unitLabel = '';
		let unitScale = 1; // world units per display unit

		if (this.worldUnitsPerMeter && this.worldUnitsPerMeter > 0) {
			const wupm = this.worldUnitsPerMeter;

			if (this.unitSystem === 'imperial') {
				// Imperial: grid in feet
				const wupf = wupm / FEET_PER_METER; // world units per foot
				unitScale = wupf;
				unitLabel = 'ft';
				minor = wupf * 5; // 5 feet
				major = wupf * 25; // 25 feet

				const screenMinor = minor * zoom;
				if (screenMinor < 8) {
					minor = wupf * 25;
					major = wupf * 100;
				} else if (screenMinor > 60) {
					minor = wupf; // 1 foot
					major = wupf * 5;
				}
			} else {
				// Metric: grid in meters
				unitScale = wupm;
				unitLabel = 'm';
				minor = wupm; // 1 meter
				major = wupm * 5; // 5 meters

				const screenMinor = minor * zoom;
				if (screenMinor < 8) {
					minor = wupm * 5;
					major = wupm * 25;
				}
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
		if (unitLabel && unitScale > 0) {
			ctx.fillStyle = LABEL_COLOR;
			const fontSize = 10 / zoom;
			ctx.font = `${fontSize}px sans-serif`;
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';

			for (let x = majorStartX; x <= majorEndX; x += major) {
				const units = Math.round(x / unitScale);
				if (units === 0) continue;
				ctx.fillText(`${units}${unitLabel}`, x + 2 / zoom, topLeft.y + 2 / zoom);
			}

			// Y-axis labels
			ctx.textAlign = 'left';
			ctx.textBaseline = 'top';
			for (let y = majorStartY; y <= majorEndY; y += major) {
				const units = Math.round(y / unitScale);
				if (units === 0) continue;
				ctx.fillText(`${units}${unitLabel}`, topLeft.x + 2 / zoom, y + 2 / zoom);
			}
		}
	}
}
