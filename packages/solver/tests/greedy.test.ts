import { describe, it, expect } from 'vitest';
import { greedy } from '../src/algorithms/greedy.js';
import { validate } from '../src/validator.js';
import { completeK5, bipartiteGraph, emptyGraph, TEST_COLORS } from './fixtures.js';
import { createGraph, addNode } from '../src/graph.js';

describe('greedy solver', () => {
	it('empty graph uses 0 colors', () => {
		const g = emptyGraph(0);
		const result = greedy(g, { algorithm: 'greedy', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(0);
		expect(result.conflicts).toEqual([]);
	});

	it('single node uses 1 color', () => {
		const g = createGraph();
		addNode(g, 'a');
		const result = greedy(g, { algorithm: 'greedy', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(1);
		expect(result.conflicts).toEqual([]);
	});

	it('K5 uses 5 colors', () => {
		const g = completeK5();
		const result = greedy(g, { algorithm: 'greedy', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(5);
		expect(result.conflicts).toEqual([]);
	});

	it('bipartite graph uses 2 colors', () => {
		const g = bipartiteGraph();
		const result = greedy(g, { algorithm: 'greedy', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(2);
		expect(result.conflicts).toEqual([]);
	});

	it('respects fixed assignments', () => {
		const g = createGraph();
		addNode(g, 'a');
		addNode(g, 'b');
		const fixed = new Map([['a', 7]]);
		const result = greedy(g, {
			algorithm: 'greedy',
			availableColors: TEST_COLORS,
			fixedAssignments: fixed
		});
		expect(result.assignment.get('a')).toBe(7);
	});

	it('produces valid coloring on all test graphs', () => {
		for (const graphFn of [completeK5, bipartiteGraph]) {
			const g = graphFn();
			const result = greedy(g, { algorithm: 'greedy', availableColors: TEST_COLORS });
			const { valid } = validate(g, result.assignment);
			expect(valid).toBe(true);
		}
	});
});
