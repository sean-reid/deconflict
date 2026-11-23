import type { Layer, RenderContext } from '../types.js';
import type { ShapePreview } from '../interactions/wall-edit.js';
import { WALL_MATERIALS } from '../materials.js';

const ERASE_COLOR = 'rgba(255, 80, 80, 0.45)';
const SNAP_COLOR = '#00d4ff';
const CLOSE_COLOR = '#00ff88';

/** Draws the wall shape in progress: vertices, pending segment or rectangle, snap markers. */
export class ShapePreviewLayer implements Layer {
	id = 'shape-preview';
	visible = true;
	private getPreview: () => ShapePreview | null;

	constructor(getPreview: () => ShapePreview | null) {
		this.getPreview = getPreview;
	}

	render(rc: RenderContext): void {
		const p = this.getPreview();
		if (!p) return;
		const { ctx, camera, dpr } = rc;
		const [a, b, c, d, e, f] = camera.getTransform();
		const zoom = camera.state.zoom;
		const mat = WALL_MATERIALS[p.materialId] ?? WALL_MATERIALS[0]!;
		const fill = p.effect === 'erase' ? ERASE_COLOR : `rgba(${mat.color.join(',')}, 0.5)`;
		const points = p.cursor ? [...p.vertices, p.cursor] : p.vertices;

		ctx.save();
		ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);

		if (points.length >= 2) {
			if (p.tool === 'rect') {
				const [p0, p1] = [points[0]!, points[1]!];
				const x = Math.min(p0.x, p1.x);
				const y = Math.min(p0.y, p1.y);
				const w = Math.abs(p1.x - p0.x);
				const h = Math.abs(p1.y - p0.y);
				if (p.effect === 'draw') {
					ctx.strokeStyle = fill;
					ctx.lineWidth = p.radius * 2;
					ctx.lineJoin = 'round';
					ctx.strokeRect(x, y, w, h);
				} else {
					ctx.fillStyle = fill;
					ctx.fillRect(x, y, w, h);
				}
			} else {
				ctx.strokeStyle = fill;
				ctx.lineWidth = p.radius * 2;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				ctx.beginPath();
				ctx.moveTo(points[0]!.x, points[0]!.y);
				for (const pt of points.slice(1)) ctx.lineTo(pt.x, pt.y);
				ctx.stroke();
			}
		}

		// Markers keep a constant on-screen size
		ctx.lineWidth = 1.5 / zoom;
		for (const v of p.vertices) {
			ctx.beginPath();
			ctx.arc(v.x, v.y, 4 / zoom, 0, Math.PI * 2);
			ctx.fillStyle = '#ffffff';
			ctx.fill();
			ctx.strokeStyle = SNAP_COLOR;
			ctx.stroke();
		}
		if (p.cursor) {
			const ring = p.willClose ? CLOSE_COLOR : p.snappedToWall ? SNAP_COLOR : '#ffffff';
			ctx.beginPath();
			ctx.arc(p.cursor.x, p.cursor.y, (p.willClose ? 9 : 6) / zoom, 0, Math.PI * 2);
			ctx.strokeStyle = ring;
			ctx.lineWidth = 2 / zoom;
			ctx.stroke();
		}

		ctx.restore();
	}
}
