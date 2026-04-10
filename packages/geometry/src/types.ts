export interface Point {
	x: number;
	y: number;
}

export interface Circle {
	center: Point;
	radius: number;
}

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** 2D affine transform as [a, b, c, d, e, f] matching Canvas2D setTransform */
export type Matrix2D = [number, number, number, number, number, number];
