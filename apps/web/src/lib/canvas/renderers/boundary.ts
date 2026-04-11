import type { Layer, RenderContext } from '../types.js';

export class BoundaryLayer implements Layer {
	id = 'boundary';
	visible = false;
	polygon: Array<{ x: number; y: number }> = [];

	render(rc: RenderContext): void {
		if (this.polygon.length < 3) return;
		const { ctx, camera } = rc;
		const transform = camera.getTransform();
		const [a, b, c, d, e, f] = transform;
		ctx.transform(a, b, c, d, e, f);

		ctx.beginPath();
		ctx.moveTo(this.polygon[0]!.x, this.polygon[0]!.y);
		for (let i = 1; i < this.polygon.length; i++) {
			ctx.lineTo(this.polygon[i]!.x, this.polygon[i]!.y);
		}
		ctx.closePath();

		// Fill with semi-transparent cyan
		ctx.fillStyle = 'rgba(0, 212, 255, 0.08)';
		ctx.fill();

		// Stroke boundary
		const zoom = camera.state.zoom;
		ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
		ctx.lineWidth = 2 / zoom;
		ctx.setLineDash([6 / zoom, 4 / zoom]);
		ctx.stroke();
		ctx.setLineDash([]);
	}
}
