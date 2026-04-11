import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/project.svelte.js';
import { channelColor } from '@deconflict/channels';

const UNASSIGNED_RING_COLOR = 'rgba(107, 113, 133, 0.15)';

const hexToRgbaCache = new Map<string, string>();

function hexToRgba(hex: string, alpha: number): string {
	const key = hex + '|' + alpha;
	const cached = hexToRgbaCache.get(key);
	if (cached) return cached;
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	const result = `rgba(${r}, ${g}, ${b}, ${alpha})`;
	hexToRgbaCache.set(key, result);
	return result;
}

export class RangeRingLayer implements Layer {
	id = 'range-rings';
	visible = true;

	aps: AccessPoint[] = [];

	render(rc: RenderContext): void {
		const { ctx, camera } = rc;
		const transform = camera.getTransform();
		const zoom = camera.state.zoom;
		const [a, b, c, d, e, f] = transform;
		ctx.transform(a, b, c, d, e, f);

		const screenScale = 1 / zoom;

		for (const ap of this.aps) {
			let strokeColor: string;
			if (ap.assignedChannel !== null) {
				const hex = channelColor(ap.assignedChannel, ap.band);
				strokeColor = hexToRgba(hex, 0.2);
			} else {
				strokeColor = UNASSIGNED_RING_COLOR;
			}

			ctx.beginPath();
			ctx.arc(ap.x, ap.y, ap.interferenceRadius, 0, Math.PI * 2);
			ctx.strokeStyle = strokeColor;
			ctx.lineWidth = 1.5 * screenScale;
			ctx.setLineDash([8 / zoom, 4 / zoom]);
			ctx.stroke();
			ctx.setLineDash([]);
		}
	}
}
