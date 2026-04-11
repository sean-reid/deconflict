import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/project.svelte.js';

interface Edge {
	aId: string;
	bId: string;
	isConflict: boolean;
	overlapFraction: number;
}

export class ConflictEdgeLayer implements Layer {
	id = 'conflict-edges';
	visible = true;
	edges: Edge[] = [];

	private _aps: AccessPoint[] = [];
	private _apMap = new Map<string, AccessPoint>();

	get aps(): AccessPoint[] {
		return this._aps;
	}

	set aps(value: AccessPoint[]) {
		this._aps = value;
		this._apMap = new Map(value.map((ap) => [ap.id, ap]));
	}

	render(rc: RenderContext): void {
		const { ctx, camera } = rc;
		const transform = camera.getTransform();
		const [a, b, c, d, e, f] = transform;
		ctx.transform(a, b, c, d, e, f);

		const zoom = camera.state.zoom;
		const apMap = this._apMap;

		for (const edge of this.edges) {
			const apA = apMap.get(edge.aId);
			const apB = apMap.get(edge.bId);
			if (!apA || !apB) continue;

			ctx.beginPath();
			ctx.moveTo(apA.x, apA.y);
			ctx.lineTo(apB.x, apB.y);

			if (edge.isConflict) {
				// Red dashed line for same-channel conflicts
				const opacity = 0.5 + 0.4 * edge.overlapFraction;
				const width = 1.5 + 1.5 * edge.overlapFraction;
				ctx.strokeStyle = `rgba(255, 68, 68, ${opacity.toFixed(2)})`;
				ctx.lineWidth = width / zoom;
				ctx.setLineDash([6 / zoom, 4 / zoom]);
			} else if (edge.overlapFraction >= 0.3) {
				// Amber/yellow warning line for high overlap, different channels
				const opacity = 0.25 + 0.35 * edge.overlapFraction;
				const width = 1 + 0.5 * edge.overlapFraction;
				ctx.strokeStyle = `rgba(217, 164, 6, ${opacity.toFixed(2)})`;
				ctx.lineWidth = width / zoom;
				ctx.setLineDash([]);
			} else {
				// Subtle gray line for low-overlap interference edges
				const opacity = 0.1 + 0.2 * edge.overlapFraction;
				ctx.strokeStyle = `rgba(107, 113, 133, ${opacity.toFixed(2)})`;
				ctx.lineWidth = 1 / zoom;
				ctx.setLineDash([]);
			}

			ctx.stroke();
			ctx.setLineDash([]);
		}
	}
}
