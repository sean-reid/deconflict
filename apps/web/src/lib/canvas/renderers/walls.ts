import type { Layer, RenderContext } from '../types.js';

export interface WallSegment {
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	thickness: number;
	material: string; // 'drywall' | 'concrete' | 'glass' | 'brick' | 'metal'
	attenuation: number; // dB loss
}

export class WallLayer implements Layer {
	id = 'walls';
	visible = true;
	walls: WallSegment[] = [];

	render(rc: RenderContext): void {
		if (this.walls.length === 0) return;
		const { ctx, camera } = rc;
		const transform = camera.getTransform();
		const [a, b, c, d, e, f] = transform;
		ctx.transform(a, b, c, d, e, f);

		const zoom = camera.state.zoom;

		for (const wall of this.walls) {
			ctx.beginPath();
			ctx.moveTo(wall.x1, wall.y1);
			ctx.lineTo(wall.x2, wall.y2);

			// Color by material
			ctx.strokeStyle = materialColor(wall.material);
			ctx.lineWidth = Math.max(wall.thickness, 2 / zoom);
			ctx.stroke();
		}
	}
}

function materialColor(material: string): string {
	switch (material) {
		case 'concrete':
			return 'rgba(180, 80, 80, 0.7)';
		case 'brick':
			return 'rgba(200, 120, 60, 0.7)';
		case 'glass':
			return 'rgba(100, 200, 255, 0.7)';
		case 'metal':
			return 'rgba(160, 160, 180, 0.7)';
		default:
			return 'rgba(255, 200, 100, 0.6)'; // drywall default
	}
}
