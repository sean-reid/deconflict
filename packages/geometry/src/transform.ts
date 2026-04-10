import type { Point } from './types.js';
import type { Matrix2D } from './types.js';

export function identity(): Matrix2D {
	return [1, 0, 0, 1, 0, 0];
}

export function multiply(a: Matrix2D, b: Matrix2D): Matrix2D {
	const [a0, a1, a2, a3, a4, a5] = a;
	const [b0, b1, b2, b3, b4, b5] = b;
	return [
		a0 * b0 + a2 * b1,
		a1 * b0 + a3 * b1,
		a0 * b2 + a2 * b3,
		a1 * b2 + a3 * b3,
		a0 * b4 + a2 * b5 + a4,
		a1 * b4 + a3 * b5 + a5,
	];
}

export function translate(m: Matrix2D, tx: number, ty: number): Matrix2D {
	return multiply(m, [1, 0, 0, 1, tx, ty]);
}

export function scale(m: Matrix2D, sx: number, sy: number): Matrix2D {
	return multiply(m, [sx, 0, 0, sy, 0, 0]);
}

export function invert(m: Matrix2D): Matrix2D {
	const [a, b, c, d, e, f] = m;
	const det = a * d - b * c;

	if (det === 0) {
		throw new Error('Matrix is not invertible: determinant is 0');
	}

	const invDet = 1 / det;
	return [
		d * invDet,
		-b * invDet,
		-c * invDet,
		a * invDet,
		(c * f - d * e) * invDet,
		(b * e - a * f) * invDet,
	];
}

export function applyToPoint(m: Matrix2D, p: Point): Point {
	const [a, b, c, d, e, f] = m;
	return {
		x: a * p.x + c * p.y + e,
		y: b * p.x + d * p.y + f,
	};
}
