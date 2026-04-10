import type { Point, Circle, Rect } from './types.js';
import { euclidean } from './distance.js';

export function circlesOverlap(a: Circle, b: Circle): boolean {
	return euclidean(a.center, b.center) < a.radius + b.radius;
}

export function circleOverlapArea(a: Circle, b: Circle): number {
	const d = euclidean(a.center, b.center);
	const r1 = a.radius;
	const r2 = b.radius;

	if (d >= r1 + r2) {
		return 0;
	}

	if (d + r2 <= r1) {
		return Math.PI * r2 * r2;
	}

	if (d + r1 <= r2) {
		return Math.PI * r1 * r1;
	}

	const r1sq = r1 * r1;
	const r2sq = r2 * r2;
	const dsq = d * d;

	const alpha = Math.acos((dsq + r1sq - r2sq) / (2 * d * r1));
	const beta = Math.acos((dsq + r2sq - r1sq) / (2 * d * r2));

	return (
		r1sq * alpha + r2sq * beta - (r1sq * Math.sin(2 * alpha)) / 2 - (r2sq * Math.sin(2 * beta)) / 2
	);
}

export function pointInCircle(p: Point, c: Circle): boolean {
	return euclidean(p, c.center) <= c.radius;
}

export function pointInRect(p: Point, r: Rect): boolean {
	return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
