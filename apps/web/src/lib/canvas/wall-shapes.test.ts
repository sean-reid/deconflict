import { describe, expect, it } from 'vitest';
import { TiledMask } from './tiled-mask.js';
import type { DecodedWallMask } from './wall-detect.js';
import {
	applyRect,
	findNearestWall,
	findWallAlongRay,
	snapAngle,
	stampCapsule
} from './wall-shapes.js';

/** Flat mask in world space with the given wall pixels set. */
function flatMask(
	originX: number,
	originY: number,
	width: number,
	height: number,
	walls: [number, number][]
): DecodedWallMask {
	const data = new Uint8Array(width * height);
	for (const [x, y] of walls) data[(y - originY) * width + (x - originX)] = 1;
	return { data, width, height, originX, originY };
}

function column(x: number, y0: number, y1: number): [number, number][] {
	const out: [number, number][] = [];
	for (let y = y0; y <= y1; y++) out.push([x, y]);
	return out;
}

describe('stampCapsule', () => {
	it('draws a thick segment with round caps and the given material', () => {
		const mask = new TiledMask();
		stampCapsule(mask, { x: 0, y: 0 }, { x: 20, y: 0 }, 3, 'draw', 2);
		expect(mask.getPixel(10, 3)).toBe(1);
		expect(mask.getPixel(10, 4)).toBe(0);
		expect(mask.getPixel(23, 0)).toBe(1);
		expect(mask.getPixel(24, 0)).toBe(0);
		expect(mask.getMaterial(10, 0)).toBe(2);
	});

	it('does nothing for a segment shorter than one unit', () => {
		const mask = new TiledMask();
		stampCapsule(mask, { x: 5, y: 5 }, { x: 5.5, y: 5 }, 3, 'draw', 0);
		expect(mask.isEmpty).toBe(true);
	});

	it('erases inside the capsule only', () => {
		const mask = new TiledMask();
		mask.paintCircle(10, 0, 8, 1);
		stampCapsule(mask, { x: 0, y: 0 }, { x: 20, y: 0 }, 2, 'erase', 0);
		expect(mask.getPixel(10, 0)).toBe(0);
		expect(mask.getPixel(10, 2)).toBe(0);
		expect(mask.getPixel(10, 5)).toBe(1);
	});

	it('repaints material on wall pixels without creating walls', () => {
		const mask = new TiledMask();
		mask.setPixel(5, 0, 1);
		stampCapsule(mask, { x: 0, y: 0 }, { x: 20, y: 0 }, 5, 'material', 3);
		expect(mask.getMaterial(5, 0)).toBe(3);
		expect(mask.getPixel(5, 4)).toBe(0);
		expect(mask.getMaterial(5, 4)).toBe(0);
	});

	it('works at negative coordinates', () => {
		const mask = new TiledMask();
		stampCapsule(mask, { x: -300, y: -40 }, { x: -260, y: -40 }, 2, 'draw', 1);
		expect(mask.getPixel(-280, -40)).toBe(1);
		expect(mask.getPixel(-280, -37)).toBe(0);
	});
});

describe('applyRect', () => {
	it('draws the outline in draw mode', () => {
		const mask = new TiledMask();
		applyRect(mask, { x: 0, y: 0 }, { x: 40, y: 30 }, 2, 'draw', 1);
		expect(mask.getPixel(20, 0)).toBe(1);
		expect(mask.getPixel(0, 15)).toBe(1);
		expect(mask.getPixel(20, 15)).toBe(0);
	});

	it('clears the whole area between the corners in erase mode', () => {
		const mask = new TiledMask();
		mask.setPixel(10, 10, 1);
		mask.setPixel(40, 30, 1);
		mask.setPixel(41, 30, 1);
		applyRect(mask, { x: 40, y: 30 }, { x: 0, y: 0 }, 5, 'erase', 0);
		expect(mask.getPixel(10, 10)).toBe(0);
		expect(mask.getPixel(40, 30)).toBe(0);
		expect(mask.getPixel(41, 30)).toBe(1);
	});

	it('repaints material on walls inside the area in material mode', () => {
		const mask = new TiledMask();
		mask.setPixel(10, 10, 1);
		mask.setPixel(41, 30, 1);
		applyRect(mask, { x: 0, y: 0 }, { x: 40, y: 30 }, 5, 'material', 4);
		expect(mask.getMaterial(10, 10)).toBe(4);
		expect(mask.getMaterial(41, 30)).toBe(0);
		expect(mask.getPixel(20, 20)).toBe(0);
	});

	it('does nothing when both sides are shorter than one unit', () => {
		const mask = new TiledMask();
		applyRect(mask, { x: 3, y: 3 }, { x: 3.4, y: 3.2 }, 2, 'draw', 0);
		expect(mask.isEmpty).toBe(true);
	});
});

describe('snapAngle', () => {
	const o = { x: 0, y: 0 };

	it('straightens nearly horizontal lines', () => {
		expect(snapAngle(o, { x: 100, y: 5 })).toEqual({ x: 100, y: 0 });
		expect(snapAngle(o, { x: 100, y: 12 })).toEqual({ x: 100, y: 0 });
	});

	it('leaves lines outside the tolerance untouched', () => {
		const p = { x: 100, y: 13 };
		expect(snapAngle(o, p)).toBe(p);
	});

	it('snaps to 45 degree diagonals', () => {
		const s = snapAngle(o, { x: 70, y: 72 });
		expect(s.x).toBeCloseTo(71.0, 1);
		expect(s.y).toBeCloseTo(71.0, 1);
	});

	it('handles negative directions and verticals', () => {
		const left = snapAngle(o, { x: -100, y: 4 });
		expect(left.x).toBeCloseTo(-100, 6);
		expect(left.y).toBeCloseTo(0, 6);
		const up = snapAngle(o, { x: 3, y: -80 });
		expect(up.x).toBeCloseTo(0, 6);
		expect(up.y).toBeCloseTo(-80, 6);
	});
});

describe('findNearestWall', () => {
	const mask = flatMask(-5, -5, 40, 20, [[10, 0]]);

	it('returns the nearest wall pixel within the radius', () => {
		expect(findNearestWall(mask, { x: 0, y: 0 }, 12)).toEqual({ x: 10, y: 0 });
	});

	it('returns null when no wall is within the radius', () => {
		expect(findNearestWall(mask, { x: 0, y: 0 }, 8)).toBeNull();
	});

	it('ignores walls close to the avoided point', () => {
		expect(findNearestWall(mask, { x: 0, y: 0 }, 12, { x: 10, y: 0 })).toBeNull();
	});

	it('works with negative origins', () => {
		const neg = flatMask(-100, -100, 100, 100, [[-50, -20]]);
		expect(findNearestWall(neg, { x: -45, y: -22 }, 12)).toEqual({ x: -50, y: -20 });
	});
});

describe('findWallAlongRay', () => {
	const anchor = { x: 0, y: 0 };

	it('slides forward to a wall along the direction', () => {
		const mask = flatMask(-10, -20, 100, 40, column(58, -10, 10));
		expect(findWallAlongRay(mask, anchor, { x: 50, y: 0 }, 12)).toEqual({ x: 58, y: 0 });
	});

	it('prefers the closest wall, backwards included', () => {
		const mask = flatMask(-10, -20, 100, 40, [...column(44, -10, 10), ...column(58, -10, 10)]);
		expect(findWallAlongRay(mask, anchor, { x: 50, y: 0 }, 12)).toEqual({ x: 44, y: 0 });
	});

	it('ignores the wall the anchor sits on', () => {
		const mask = flatMask(-10, -20, 100, 40, column(5, -10, 10));
		expect(findWallAlongRay(mask, anchor, { x: 14, y: 0 }, 12)).toBeNull();
	});
});
