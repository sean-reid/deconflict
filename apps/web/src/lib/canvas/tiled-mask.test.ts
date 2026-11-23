import { describe, expect, it } from 'vitest';
import { MAX_UNDO_BYTES, MAX_UNDO_STEPS, TiledMask } from './tiled-mask.js';

describe('TiledMask undo history', () => {
	it('undoes a painted circle and drops the tiles it created', () => {
		const mask = new TiledMask();
		const tilesBefore = mask.tiles.size;
		mask.beginOp();
		mask.paintCircle(10, 10, 3, 1, 2);
		expect(mask.endOp()).toBe(true);
		expect(mask.undoDepth).toBe(1);
		expect(mask.getPixel(10, 10)).toBe(1);

		expect(mask.undoOp()).toBe(true);
		expect(mask.getPixel(10, 10)).toBe(0);
		expect(mask.undoDepth).toBe(0);
		expect(mask.tiles.size).toBe(tilesBefore);
	});

	it('restores erased wall pixels and their material', () => {
		const mask = new TiledMask();
		mask.paintCircle(50, 50, 4, 1, 4);
		mask.beginOp();
		mask.paintCircle(50, 50, 4, 0);
		mask.endOp();
		expect(mask.getPixel(50, 50)).toBe(0);

		mask.undoOp();
		expect(mask.getPixel(50, 50)).toBe(1);
		expect(mask.getMaterial(50, 50)).toBe(4);
	});

	it('does not record writes made outside an operation', () => {
		const mask = new TiledMask();
		mask.setPixel(1, 1, 1);
		expect(mask.undoOp()).toBe(false);
		expect(mask.getPixel(1, 1)).toBe(1);
	});

	it('keeps no step for an operation without writes', () => {
		const mask = new TiledMask();
		mask.beginOp();
		expect(mask.endOp()).toBe(false);
		expect(mask.undoDepth).toBe(0);
	});

	it('undoes operations in reverse order', () => {
		const mask = new TiledMask();
		mask.beginOp();
		mask.setPixel(5, 5, 1);
		mask.endOp();
		mask.beginOp();
		mask.setPixel(6, 6, 1);
		mask.endOp();

		mask.undoOp();
		expect(mask.getPixel(6, 6)).toBe(0);
		expect(mask.getPixel(5, 5)).toBe(1);
		mask.undoOp();
		expect(mask.getPixel(5, 5)).toBe(0);
	});

	it('keeps at most MAX_UNDO_STEPS steps, dropping the oldest', () => {
		expect(MAX_UNDO_STEPS).toBe(50);
		const mask = new TiledMask();
		for (let i = 0; i < 51; i++) {
			mask.beginOp();
			mask.setPixel(i, 0, 1);
			mask.endOp();
		}
		expect(mask.undoDepth).toBe(50);
		for (let i = 0; i < 50; i++) mask.undoOp();
		expect(mask.getPixel(0, 0)).toBe(1);
		expect(mask.getPixel(1, 0)).toBe(0);
		expect(mask.undoOp()).toBe(false);
	});

	it('drops the oldest steps when the copies exceed MAX_UNDO_BYTES', () => {
		expect(MAX_UNDO_BYTES).toBe(32 * 1024 * 1024);
		const mask = new TiledMask();
		// 130 existing tiles, written outside any operation
		for (let t = 0; t < 130; t++) mask.setPixel(t * 256, 0, 1);
		// each step touches 128 existing tiles: 128 * 64 KiB = 8 MiB of copies
		for (let op = 0; op < 5; op++) {
			mask.beginOp();
			for (let t = 0; t < 128; t++) mask.setPixel(t * 256 + 1 + op, 1, 1);
			mask.endOp();
		}
		expect(mask.undoDepth).toBe(4);
	});

	it('undoes writes at negative coordinates', () => {
		const mask = new TiledMask();
		mask.beginOp();
		mask.paintCircle(-300, -10, 2, 1, 1);
		mask.endOp();
		expect(mask.getPixel(-300, -10)).toBe(1);
		mask.undoOp();
		expect(mask.getPixel(-300, -10)).toBe(0);
	});

	it('clears the history', () => {
		const mask = new TiledMask();
		mask.beginOp();
		mask.setPixel(3, 3, 1);
		mask.endOp();
		mask.clearHistory();
		expect(mask.undoDepth).toBe(0);
		expect(mask.undoOp()).toBe(false);
		expect(mask.getPixel(3, 3)).toBe(1);
	});
});
