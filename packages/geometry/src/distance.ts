import type { Point } from './types.js';

export function euclidean(a: Point, b: Point): number {
	return Math.sqrt(squaredEuclidean(a, b));
}

export function squaredEuclidean(a: Point, b: Point): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return dx * dx + dy * dy;
}

export function pointToSegment(p: Point, a: Point, b: Point): number {
	const abx = b.x - a.x;
	const aby = b.y - a.y;
	const lengthSq = abx * abx + aby * aby;

	if (lengthSq === 0) {
		return euclidean(p, a);
	}

	const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq));
	const proj: Point = {
		x: a.x + t * abx,
		y: a.y + t * aby
	};

	return euclidean(p, proj);
}
