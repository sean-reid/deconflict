import { describe, it, expect } from 'vitest';
import { dsatur } from '../src/algorithms/dsatur.js';
import { greedy } from '../src/algorithms/greedy.js';
import { validate } from '../src/validator.js';
import {
	completeK5, bipartiteGraph, petersenGraph, cycleC5, emptyGraph, TEST_COLORS,
} from './fixtures.js';
import { createGraph, addNode } from '../src/graph.js';

describe('dsatur solver', () => {
	it('empty graph uses 0 colors', () => {
		const g = emptyGraph(0);
		const result = dsatur(g, { algorithm: 'dsatur', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(0);
		expect(result.conflicts).toEqual([]);
	});

	it('single node uses 1 color', () => {
		const g = createGraph();
		addNode(g, 'a');
		const result = dsatur(g, { algorithm: 'dsatur', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(1);
		expect(result.conflicts).toEqual([]);
	});

	it('K5 uses 5 colors', () => {
		const g = completeK5();
		const result = dsatur(g, { algorithm: 'dsatur', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(5);
		expect(result.conflicts).toEqual([]);
	});

	it('bipartite graph uses 2 colors', () => {
		const g = bipartiteGraph();
		const result = dsatur(g, { algorithm: 'dsatur', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(2);
		expect(result.conflicts).toEqual([]);
	});

	it('Petersen graph uses exactly 3 colors', () => {
		const g = petersenGraph();
		const result = dsatur(g, { algorithm: 'dsatur', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(3);
		expect(result.conflicts).toEqual([]);
	});

	it('cycle C5 uses 3 colors', () => {
		const g = cycleC5();
		const result = dsatur(g, { algorithm: 'dsatur', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(3);
		expect(result.conflicts).toEqual([]);
	});

	it('respects fixed assignments', () => {
		const g = createGraph();
		addNode(g, 'a');
		addNode(g, 'b');
		const fixed = new Map([['a', 7]]);
		const result = dsatur(g, {
			algorithm: 'dsatur',
			availableColors: TEST_COLORS,
			fixedAssignments: fixed,
		});
		expect(result.assignment.get('a')).toBe(7);
	});

	it('produces <= colors than greedy on test graphs', () => {
		for (const graphFn of [completeK5, bipartiteGraph, petersenGraph, cycleC5]) {
			const g = graphFn();
			const opts = { availableColors: TEST_COLORS } as const;
			const dsaturResult = dsatur(g, { ...opts, algorithm: 'dsatur' });
			const greedyResult = greedy(g, { ...opts, algorithm: 'greedy' });
			expect(dsaturResult.colorCount).toBeLessThanOrEqual(greedyResult.colorCount);
		}
	});
});
