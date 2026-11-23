import { beforeEach, describe, expect, it } from 'vitest';
import { appState } from '$state/app.svelte.js';
import { Camera } from '../camera.js';
import type { CanvasEngine } from '../engine.js';
import { TiledMask } from '../tiled-mask.js';
import { WallEditHandler } from './wall-edit.js';

// Identity camera and a canvas at the page origin: screen coordinates = world coordinates
function setup(): { h: WallEditHandler; mask: TiledMask } {
	const engine = {
		canvas: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
		camera: new Camera(),
		markDirty: () => {}
	} as unknown as CanvasEngine;
	const h = new WallEditHandler(engine);
	const mask = new TiledMask();
	h.tiledMask = mask;
	h.activeMaterial = 1;
	return { h, mask };
}

const at = (x: number, y: number) => ({ clientX: x, clientY: y });

function tap(h: WallEditHandler, x: number, y: number, touch = false): void {
	h.handlePointerDown(at(x, y), touch);
	h.handlePointerUp(at(x, y), touch);
}

beforeEach(() => {
	appState.wallEditMode = 'draw';
	appState.wallBrushSize = 3;
	appState.wallSnapAngles = true;
	appState.wallTool = 'line';
	appState.wallCanUndo = false;
});

describe('line tool', () => {
	it('stamps a wall between two taps', () => {
		const { h, mask } = setup();
		tap(h, 10, 10);
		tap(h, 60, 10);
		expect(mask.getPixel(35, 10)).toBe(1);
		expect(mask.undoDepth).toBe(1);
		expect(h.preview).toBeNull();
	});

	it('straightens a nearly horizontal line', () => {
		const { h, mask } = setup();
		tap(h, 10, 10);
		tap(h, 60, 14);
		expect(mask.getPixel(60, 10)).toBe(1);
		expect(mask.getPixel(60, 14)).toBe(0);
	});

	it('does nothing when the second tap lands on the anchor', () => {
		const { h, mask } = setup();
		tap(h, 10, 10);
		tap(h, 10, 10);
		expect(mask.isEmpty).toBe(true);
		expect(h.preview).toBeNull();
	});

	it('snaps the end to a nearby wall along the straightened direction', () => {
		const { h, mask } = setup();
		for (let y = -20; y <= 20; y++) mask.setPixel(58, y, 1);
		tap(h, 0, 0);
		h.handlePointerMove(at(50, 0));
		expect(h.preview?.cursor).toEqual({ x: 58, y: 0 });
		expect(h.preview?.snappedToWall).toBe(true);
	});
});

describe('polyline tool', () => {
	beforeEach(() => {
		appState.wallTool = 'polyline';
	});

	it('closes the shape when tapping the first vertex', () => {
		const { h, mask } = setup();
		tap(h, 0, 0);
		tap(h, 50, 0);
		tap(h, 50, 40);
		tap(h, 0, 0);
		expect(mask.getPixel(25, 20)).toBe(1);
		expect(mask.undoDepth).toBe(3);
		expect(h.preview).toBeNull();
	});

	it('finishes without stamping when tapping the last vertex again', () => {
		const { h, mask } = setup();
		tap(h, 0, 0);
		tap(h, 50, 0);
		tap(h, 50, 0);
		expect(mask.undoDepth).toBe(1);
		expect(h.preview).toBeNull();
	});

	it('undo removes the last segment and steps the anchor back', () => {
		const { h, mask } = setup();
		tap(h, 0, 0);
		tap(h, 50, 0);
		tap(h, 50, 40);
		expect(h.undo()).toBe(true);
		expect(mask.getPixel(50, 20)).toBe(0);
		expect(mask.getPixel(25, 0)).toBe(1);
		expect(h.preview?.vertices).toEqual([
			{ x: 0, y: 0 },
			{ x: 50, y: 0 }
		]);
	});

	it('moves the anchor across empty space in erase mode', () => {
		const { h, mask } = setup();
		for (let y = -100; y <= 100; y++) mask.setPixel(50, y, 1);
		appState.wallEditMode = 'erase';
		tap(h, 0, 0);
		tap(h, 0, 80);
		tap(h, 100, 80);
		expect(mask.getPixel(50, 80)).toBe(0);
		expect(mask.getPixel(50, 40)).toBe(1);
		expect(h.undo()).toBe(true);
		expect(mask.getPixel(50, 80)).toBe(1);
		// The angle snap leaves float noise (~1e-15) on the straightened axis
		const rounded = () =>
			h.preview?.vertices.map((v) => ({ x: Math.round(v.x), y: Math.round(v.y) }));
		expect(rounded()).toEqual([
			{ x: 0, y: 0 },
			{ x: 0, y: 80 }
		]);
		expect(h.undo()).toBe(true);
		expect(rounded()).toEqual([{ x: 0, y: 0 }]);
	});

	it('survives undoing past the end of the history', () => {
		const { h, mask } = setup();
		for (let i = 0; i <= 55; i++) tap(h, i * 50, (i % 2) * 50);
		expect(mask.undoDepth).toBe(50);
		expect(() => {
			for (let i = 0; i < 60; i++) h.undo();
		}).not.toThrow();
		expect(h.preview).toBeNull();
		expect(h.canUndo).toBe(false);
	});
});

describe('rect tool', () => {
	it('clears the area between the corners in erase mode', () => {
		const { h, mask } = setup();
		for (let y = 10; y <= 20; y++) for (let x = 15; x <= 25; x++) mask.setPixel(x, y, 1);
		appState.wallTool = 'rect';
		appState.wallEditMode = 'erase';
		tap(h, 0, 0);
		tap(h, 40, 30);
		expect(mask.getPixel(20, 15)).toBe(0);
	});
});

describe('undo', () => {
	it('removes an anchor that was not stamped yet', () => {
		const { h, mask } = setup();
		tap(h, 10, 10);
		expect(h.undo()).toBe(true);
		expect(mask.undoDepth).toBe(0);
		expect(h.preview).toBeNull();
	});

	it('finishShape and resetHistory clear the anchor, the history and the undo flag', () => {
		const { h, mask } = setup();
		tap(h, 0, 0);
		tap(h, 40, 0);
		tap(h, 80, 30);
		expect(appState.wallCanUndo).toBe(true);
		h.finishShape();
		h.resetHistory();
		expect(h.preview).toBeNull();
		expect(mask.undoDepth).toBe(0);
		expect(appState.wallCanUndo).toBe(false);
	});
});

describe('touch gestures', () => {
	it('a second finger cancels a pending brush stroke without painting', () => {
		const { h, mask } = setup();
		appState.wallTool = 'brush';
		h.handlePointerDown(at(10, 10), true);
		h.cancelGesture();
		h.handlePointerUp(undefined, true);
		expect(mask.isEmpty).toBe(true);
		expect(mask.undoDepth).toBe(0);
	});

	it('a brush tap without moving paints a dot', () => {
		const { h, mask } = setup();
		appState.wallTool = 'brush';
		tap(h, 10, 10, true);
		expect(mask.getPixel(10, 10)).toBe(1);
		expect(mask.undoDepth).toBe(1);
	});

	it('the brush waits for more than 3 px of movement before painting', () => {
		const { h, mask } = setup();
		appState.wallTool = 'brush';
		h.handlePointerDown(at(10, 10), true);
		h.handlePointerMove(at(12, 10), true);
		expect(mask.isEmpty).toBe(true);
		h.handlePointerMove(at(30, 10), true);
		expect(mask.getPixel(20, 10)).toBe(1);
	});

	it('a second finger drops the provisional point and keeps the anchor', () => {
		const { h, mask } = setup();
		tap(h, 0, 0, true);
		h.handlePointerDown(at(40, 0), true);
		h.cancelGesture();
		expect(mask.isEmpty).toBe(true);
		expect(h.preview?.vertices).toEqual([{ x: 0, y: 0 }]);
		expect(h.preview?.cursor).toBeNull();
	});
});
