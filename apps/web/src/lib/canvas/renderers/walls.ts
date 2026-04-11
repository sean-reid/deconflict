import type { Layer, RenderContext } from '../types.js';

export interface WallSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	thickness: number;
	material: string;
	attenuation: number;
}

const MATERIAL_COLORS: Record<string, { fill: string; stroke: string }> = {
	drywall: { fill: 'rgb(200, 200, 210)', stroke: 'rgb(160, 165, 180)' },
	concrete: { fill: 'rgb(140, 130, 125)', stroke: 'rgb(100, 95, 90)' },
	brick: { fill: 'rgb(180, 120, 90)', stroke: 'rgb(150, 90, 60)' },
	glass: { fill: 'rgb(140, 210, 240)', stroke: 'rgb(100, 190, 230)' },
	metal: { fill: 'rgb(170, 175, 185)', stroke: 'rgb(130, 135, 145)' }
};

export class WallLayer implements Layer {
	id = 'walls';
	visible = true;
	walls: WallSegment[] = [];

	render(rc: RenderContext): void {
		if (this.walls.length === 0) return;
		const { camera, width, height } = rc;
		const transform = camera.getTransform();
		const zoom = camera.state.zoom;

		// Render walls to an offscreen canvas to prevent alpha accumulation
		// at wall intersections
		const offscreen = document.createElement('canvas');
		offscreen.width = width;
		offscreen.height = height;
		const oc = offscreen.getContext('2d')!;

		// Apply camera transform
		const [a, b, c, d, e, f] = transform;
		oc.setTransform(a, b, c, d, e, f);

		for (const wall of this.walls) {
			const style = MATERIAL_COLORS[wall.material] ?? MATERIAL_COLORS['drywall']!;
			const t = Math.max(wall.thickness, 2 / zoom);

			const dx = wall.x2 - wall.x1;
			const dy = wall.y2 - wall.y1;
			const len = Math.sqrt(dx * dx + dy * dy);
			if (len === 0) continue;
			const nx = (-dy / len) * (t / 2);
			const ny = (dx / len) * (t / 2);

			// Filled wall body (opaque on offscreen)
			oc.beginPath();
			oc.moveTo(wall.x1 + nx, wall.y1 + ny);
			oc.lineTo(wall.x2 + nx, wall.y2 + ny);
			oc.lineTo(wall.x2 - nx, wall.y2 - ny);
			oc.lineTo(wall.x1 - nx, wall.y1 - ny);
			oc.closePath();
			oc.fillStyle = style.fill;
			oc.fill();

			// Thin edge lines
			oc.strokeStyle = style.stroke;
			oc.lineWidth = 0.5 / zoom;
			oc.stroke();
		}

		rc.compositeOffscreen(offscreen, 0.4);
	}
}
