import { describe, expect, it } from 'vitest';
import { rasterizeCells } from './heatmap.js';

const GREEN = 0xff00ff00;

describe('rasterizeCells', () => {
	it('fills every pixel when the canvas CSS size is fractional', () => {
		// Firefox on Android reports widths like 424.727px for the canvas container
		const { w, h, pixels } = rasterizeCells(400.5, 30.2, 6, () => GREEN);
		expect([w, h]).toEqual([401, 31]);
		expect(pixels.length).toBe(w * h);
		expect(pixels.every((p) => p === GREEN)).toBe(true);
	});

	it('fills every pixel for integer sizes', () => {
		const { w, h, pixels } = rasterizeCells(412, 50, 6, () => GREEN);
		expect([w, h]).toEqual([412, 50]);
		expect(pixels.every((p) => p === GREEN)).toBe(true);
	});

	it('samples each cell at its centre and leaves zero-colour cells transparent', () => {
		const calls: [number, number][] = [];
		const { pixels, w } = rasterizeCells(12.5, 6, 6, (sx, sy) => {
			calls.push([sx, sy]);
			return sx < 6 ? GREEN : 0;
		});
		expect(calls).toEqual([
			[3, 3],
			[9, 3],
			[15, 3]
		]);
		expect(pixels[0]).toBe(GREEN);
		expect(pixels[w - 1]).toBe(0);
	});
});
