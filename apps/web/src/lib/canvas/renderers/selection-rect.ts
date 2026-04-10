import type { Layer, RenderContext } from '../types.js';

export class SelectionRectLayer implements Layer {
	id = 'selection-rect';
	visible = true;

	// World coordinates of the selection box
	startX = 0;
	startY = 0;
	endX = 0;
	endY = 0;
	active = false;

	render(rc: RenderContext): void {
		if (!this.active) return;
		const { ctx, camera } = rc;
		const transform = camera.getTransform();
		const [a, b, c, d, e, f] = transform;
		ctx.transform(a, b, c, d, e, f);

		const x = Math.min(this.startX, this.endX);
		const y = Math.min(this.startY, this.endY);
		const w = Math.abs(this.endX - this.startX);
		const h = Math.abs(this.endY - this.startY);

		const zoom = camera.state.zoom;

		// Fill
		ctx.fillStyle = 'rgba(0, 212, 255, 0.08)';
		ctx.fillRect(x, y, w, h);

		// Border
		ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
		ctx.lineWidth = 1 / zoom;
		ctx.setLineDash([4 / zoom, 4 / zoom]);
		ctx.strokeRect(x, y, w, h);
		ctx.setLineDash([]);
	}
}
