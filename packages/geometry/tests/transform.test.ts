import { describe, it, expect } from 'vitest';
import { identity, translate, scale, multiply, invert, applyToPoint } from '../src/transform.js';

describe('identity', () => {
	it('returns the same point when applied', () => {
		const p = applyToPoint(identity(), { x: 5, y: 10 });
		expect(p).toEqual({ x: 5, y: 10 });
	});
});

describe('translate', () => {
	it('shifts a point by the given offset', () => {
		const m = translate(identity(), 10, 20);
		const p = applyToPoint(m, { x: 0, y: 0 });
		expect(p).toEqual({ x: 10, y: 20 });
	});
});

describe('scale', () => {
	it('scales a point by the given factors', () => {
		const m = scale(identity(), 2, 3);
		const p = applyToPoint(m, { x: 5, y: 10 });
		expect(p).toEqual({ x: 10, y: 30 });
	});
});

describe('multiply', () => {
	it('combines two translations', () => {
		const a = translate(identity(), 5, 10);
		const b = translate(identity(), 3, 7);
		const combined = multiply(a, b);
		const p = applyToPoint(combined, { x: 0, y: 0 });
		expect(p).toEqual({ x: 8, y: 17 });
	});
});

describe('invert', () => {
	it('reverses a translation', () => {
		const m = translate(identity(), 10, 20);
		const inv = invert(m);
		const p = applyToPoint(inv, applyToPoint(m, { x: 7, y: 3 }));
		expect(p.x).toBeCloseTo(7);
		expect(p.y).toBeCloseTo(3);
	});

	it('reverses a scale', () => {
		const m = scale(identity(), 2, 2);
		const inv = invert(m);
		const p = applyToPoint(inv, applyToPoint(m, { x: 5, y: 10 }));
		expect(p.x).toBeCloseTo(5);
		expect(p.y).toBeCloseTo(10);
	});
});
