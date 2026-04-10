import { describe, it, expect } from 'vitest';
import { euclidean, squaredEuclidean, pointToSegment } from '../src/distance.js';

describe('euclidean', () => {
	it('returns 5 for a 3-4-5 triangle', () => {
		expect(euclidean({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
	});

	it('returns 0 for identical points', () => {
		expect(euclidean({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
	});
});

describe('squaredEuclidean', () => {
	it('returns 25 for a 3-4-5 triangle', () => {
		expect(squaredEuclidean({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
	});
});

describe('pointToSegment', () => {
	it('returns 0 when point lies on the segment', () => {
		expect(pointToSegment({ x: 0.5, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(0);
	});

	it('returns perpendicular distance', () => {
		expect(pointToSegment({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(1);
	});

	it('returns distance to nearest endpoint when projection falls outside segment', () => {
		const dist = pointToSegment({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 });
		expect(dist).toBeCloseTo(1);
	});
});
