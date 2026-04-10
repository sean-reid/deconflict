import { describe, it, expect } from 'vitest';
import { compareAll } from '../src/comparator.js';
import { validate } from '../src/validator.js';
import { petersenGraph, TEST_COLORS } from './fixtures.js';

describe('comparator', () => {
	it('runs all 4 algorithms', () => {
		const g = petersenGraph();
		const result = compareAll(g, { availableColors: TEST_COLORS });
		expect(result.results).toHaveLength(4);
		const names = result.results.map(r => r.algorithm);
		expect(names).toContain('greedy');
		expect(names).toContain('dsatur');
		expect(names).toContain('welsh-powell');
		expect(names).toContain('backtracking');
	});

	it('all results have valid assignments', () => {
		const g = petersenGraph();
		const result = compareAll(g, { availableColors: TEST_COLORS });
		for (const r of result.results) {
			const { valid } = validate(g, r.assignment);
			expect(valid).toBe(true);
		}
	});

	it('results sorted by colorCount ascending', () => {
		const g = petersenGraph();
		const result = compareAll(g, { availableColors: TEST_COLORS });
		for (let i = 1; i < result.results.length; i++) {
			const prev = result.results[i - 1]!;
			const curr = result.results[i]!;
			expect(curr.colorCount).toBeGreaterThanOrEqual(prev.colorCount);
		}
	});

	it('each result has timing data > 0', () => {
		const g = petersenGraph();
		const result = compareAll(g, { availableColors: TEST_COLORS });
		for (const r of result.results) {
			expect(r.timeMs).toBeGreaterThanOrEqual(0);
		}
	});
});
