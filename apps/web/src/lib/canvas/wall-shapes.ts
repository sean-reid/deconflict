/**
 * Pure helpers for the wall shape tools: rasterize lines and rectangles into
 * the wall mask, straighten angles and find nearby walls to snap to.
 */
import type { Point } from '@deconflict/geometry';
import type { TiledMask } from './tiled-mask.js';
import type { DecodedWallMask } from './wall-detect.js';

export type WallEditEffect = 'draw' | 'erase' | 'material';

/** Apply one mode's effect to a single pixel. */
function applyPixel(
	mask: TiledMask,
	x: number,
	y: number,
	effect: WallEditEffect,
	materialId: number
): void {
	if (effect === 'draw') {
		mask.setPixel(x, y, 1);
		mask.setMaterial(x, y, materialId);
	} else if (mask.getPixel(x, y)) {
		// Erase and material only touch existing walls (no empty tiles allocated)
		if (effect === 'erase') mask.setPixel(x, y, 0);
		else mask.setMaterial(x, y, materialId);
	}
}

/** Squared distance from (px, py) to segment ab. */
function distSqToSegment(px: number, py: number, a: Point, b: Point): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const lenSq = dx * dx + dy * dy;
	let t = lenSq > 0 ? ((px - a.x) * dx + (py - a.y) * dy) / lenSq : 0;
	t = Math.max(0, Math.min(1, t));
	const cx = a.x + t * dx - px;
	const cy = a.y + t * dy - py;
	return cx * cx + cy * cy;
}

/** Rasterize a segment with round caps: every pixel within `radius` of ab. */
export function stampCapsule(
	mask: TiledMask,
	a: Point,
	b: Point,
	radius: number,
	effect: WallEditEffect,
	materialId: number
): void {
	if (Math.hypot(b.x - a.x, b.y - a.y) < 1) return;
	const r2 = radius * radius;
	const x0 = Math.floor(Math.min(a.x, b.x) - radius);
	const x1 = Math.ceil(Math.max(a.x, b.x) + radius);
	const y0 = Math.floor(Math.min(a.y, b.y) - radius);
	const y1 = Math.ceil(Math.max(a.y, b.y) + radius);
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			if (distSqToSegment(x, y, a, b) <= r2) applyPixel(mask, x, y, effect, materialId);
		}
	}
	mask.markDirty();
}

/** Rectangle between two opposite corners: outline when drawing, filled area otherwise. */
export function applyRect(
	mask: TiledMask,
	a: Point,
	b: Point,
	radius: number,
	effect: WallEditEffect,
	materialId: number
): void {
	if (Math.abs(b.x - a.x) < 1 && Math.abs(b.y - a.y) < 1) return;
	if (effect === 'draw') {
		const c1 = { x: b.x, y: a.y };
		const c2 = { x: a.x, y: b.y };
		stampCapsule(mask, a, c1, radius, effect, materialId);
		stampCapsule(mask, c1, b, radius, effect, materialId);
		stampCapsule(mask, b, c2, radius, effect, materialId);
		stampCapsule(mask, c2, a, radius, effect, materialId);
		return;
	}
	const x0 = Math.round(Math.min(a.x, b.x));
	const x1 = Math.round(Math.max(a.x, b.x));
	const y0 = Math.round(Math.min(a.y, b.y));
	const y1 = Math.round(Math.max(a.y, b.y));
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) applyPixel(mask, x, y, effect, materialId);
	}
	mask.markDirty();
}

/**
 * Straighten anchor→p to the nearest multiple of 45° when within the tolerance,
 * keeping the projected length. Returns `p` itself when left untouched.
 */
export function snapAngle(anchor: Point, p: Point, toleranceDeg = 7): Point {
	const dx = p.x - anchor.x;
	const dy = p.y - anchor.y;
	if (dx === 0 && dy === 0) return p;
	const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
	const snapped = Math.round(angle / 45) * 45;
	if (Math.abs(angle - snapped) > toleranceDeg) return p;
	const rad = (snapped * Math.PI) / 180;
	const ux = Math.cos(rad);
	const uy = Math.sin(rad);
	const len = dx * ux + dy * uy;
	return { x: anchor.x + ux * len, y: anchor.y + uy * len };
}

function isWall(mask: DecodedWallMask, x: number, y: number): boolean {
	const lx = x - mask.originX;
	const ly = y - mask.originY;
	if (lx < 0 || ly < 0 || lx >= mask.width || ly >= mask.height) return false;
	return mask.data[ly * mask.width + lx] === 1;
}

/** Nearest wall pixel within `radius` of p, skipping walls closer than `radius` to `avoid`. */
export function findNearestWall(
	mask: DecodedWallMask,
	p: Point,
	radius: number,
	avoid?: Point
): Point | null {
	const r2 = radius * radius;
	const x0 = Math.max(Math.floor(p.x - radius), mask.originX);
	const x1 = Math.min(Math.ceil(p.x + radius), mask.originX + mask.width - 1);
	const y0 = Math.max(Math.floor(p.y - radius), mask.originY);
	const y1 = Math.min(Math.ceil(p.y + radius), mask.originY + mask.height - 1);
	let best: Point | null = null;
	let bestD2 = Infinity;
	for (let y = y0; y <= y1; y++) {
		const row = (y - mask.originY) * mask.width - mask.originX;
		for (let x = x0; x <= x1; x++) {
			if (mask.data[row + x] !== 1) continue;
			const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
			if (d2 > r2 || d2 >= bestD2) continue;
			if (avoid && (x - avoid.x) ** 2 + (y - avoid.y) ** 2 < r2) continue;
			best = { x, y };
			bestD2 = d2;
		}
	}
	return best;
}

/**
 * Slide p along the anchor→p direction (forwards or backwards, up to `radius`)
 * to the closest wall, ignoring walls closer than `radius` to the anchor.
 */
export function findWallAlongRay(
	mask: DecodedWallMask,
	anchor: Point,
	p: Point,
	radius: number
): Point | null {
	const len = Math.hypot(p.x - anchor.x, p.y - anchor.y);
	if (len === 0) return null;
	const ux = (p.x - anchor.x) / len;
	const uy = (p.y - anchor.y) / len;
	const r2 = radius * radius;
	const maxStep = Math.floor(radius);
	for (let step = 0; step <= maxStep; step++) {
		for (const d of step === 0 ? [0] : [step, -step]) {
			const q = { x: p.x + d * ux, y: p.y + d * uy };
			if ((q.x - anchor.x) ** 2 + (q.y - anchor.y) ** 2 < r2) continue;
			if (isWall(mask, Math.round(q.x), Math.round(q.y))) return q;
		}
	}
	return null;
}
