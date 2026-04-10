import { describe, it, expect } from 'vitest';
import {
	circlesOverlap,
	circleOverlapArea,
	pointInCircle,
	pointInRect,
	rectsOverlap,
} from '../src/intersection.js';

describe('circlesOverlap', () => {
	it('returns true for overlapping circles', () => {
		const a = { center: { x: 0, y: 0 }, radius: 10 };
		const b = { center: { x: 15, y: 0 }, radius: 10 };
		expect(circlesOverlap(a, b)).toBe(true);
	});

	it('returns false for tangent circles (distance equals sum of radii)', () => {
		const a = { center: { x: 0, y: 0 }, radius: 5 };
		const b = { center: { x: 10, y: 0 }, radius: 5 };
		expect(circlesOverlap(a, b)).toBe(false);
	});

	it('returns false for non-overlapping circles', () => {
		const a = { center: { x: 0, y: 0 }, radius: 5 };
		const b = { center: { x: 20, y: 0 }, radius: 5 };
		expect(circlesOverlap(a, b)).toBe(false);
	});
});

describe('circleOverlapArea', () => {
	it('returns pi*r^2 for identical circles', () => {
		const c = { center: { x: 0, y: 0 }, radius: 5 };
		expect(circleOverlapArea(c, c)).toBeCloseTo(Math.PI * 25);
	});

	it('returns 0 for non-overlapping circles', () => {
		const a = { center: { x: 0, y: 0 }, radius: 5 };
		const b = { center: { x: 20, y: 0 }, radius: 5 };
		expect(circleOverlapArea(a, b)).toBe(0);
	});
});

describe('pointInCircle', () => {
	it('returns true for center point', () => {
		const c = { center: { x: 5, y: 5 }, radius: 10 };
		expect(pointInCircle({ x: 5, y: 5 }, c)).toBe(true);
	});

	it('returns true for point on boundary', () => {
		const c = { center: { x: 0, y: 0 }, radius: 5 };
		expect(pointInCircle({ x: 5, y: 0 }, c)).toBe(true);
	});
});

describe('pointInRect', () => {
	it('returns true for point inside rect', () => {
		expect(pointInRect({ x: 5, y: 5 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
	});

	it('returns false for point outside rect', () => {
		expect(pointInRect({ x: 15, y: 5 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(false);
	});

	it('returns true for point on boundary', () => {
		expect(pointInRect({ x: 10, y: 5 }, { x: 0, y: 0, width: 10, height: 10 })).toBe(true);
	});
});

describe('rectsOverlap', () => {
	it('returns true for overlapping rects', () => {
		const a = { x: 0, y: 0, width: 10, height: 10 };
		const b = { x: 5, y: 5, width: 10, height: 10 };
		expect(rectsOverlap(a, b)).toBe(true);
	});

	it('returns false for adjacent rects (not overlapping)', () => {
		const a = { x: 0, y: 0, width: 10, height: 10 };
		const b = { x: 10, y: 0, width: 10, height: 10 };
		expect(rectsOverlap(a, b)).toBe(false);
	});

	it('returns true when one rect is contained in another', () => {
		const a = { x: 0, y: 0, width: 20, height: 20 };
		const b = { x: 5, y: 5, width: 5, height: 5 };
		expect(rectsOverlap(a, b)).toBe(true);
	});
});
