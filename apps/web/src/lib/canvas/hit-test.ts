import type { Point } from '@deconflict/geometry';
import type { AccessPoint } from '$state/project.svelte.js';
import type { Camera } from './camera.js';

export interface HitResult {
	type: 'ap';
	id: string;
}

export function hitTest(
	screenPoint: Point,
	camera: Camera,
	aps: AccessPoint[]
): HitResult | null {
	const worldPoint = camera.screenToWorld(screenPoint);
	const hitRadius = 12 / camera.state.zoom;

	// Test in reverse order (topmost first)
	for (let i = aps.length - 1; i >= 0; i--) {
		const ap = aps[i]!;
		const dx = worldPoint.x - ap.x;
		const dy = worldPoint.y - ap.y;
		if (dx * dx + dy * dy <= hitRadius * hitRadius) {
			return { type: 'ap', id: ap.id };
		}
	}
	return null;
}
