import { describe, it, expect } from 'vitest';
import { backtracking } from '../src/algorithms/backtracking.js';
import {
	completeK5, bipartiteGraph, petersenGraph, cycleC5, emptyGraph, TEST_COLORS,
} from './fixtures.js';
import { createGraph, addNode, addEdge } from '../src/graph.js';

describe('backtracking solver', () => {
	it('K5 uses exactly 5 colors', () => {
		const g = completeK5();
		const result = backtracking(g, { algorithm: 'backtracking', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(5);
		expect(result.conflicts).toEqual([]);
	});

	it('Petersen graph uses exactly 3 colors', () => {
		const g = petersenGraph();
		const result = backtracking(g, { algorithm: 'backtracking', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(3);
		expect(result.conflicts).toEqual([]);
	});

	it('bipartite graph uses exactly 2 colors', () => {
		const g = bipartiteGraph();
		const result = backtracking(g, { algorithm: 'backtracking', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(2);
		expect(result.conflicts).toEqual([]);
	});

	it('cycle C5 uses exactly 3 colors', () => {
		const g = cycleC5();
		const result = backtracking(g, { algorithm: 'backtracking', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(3);
		expect(result.conflicts).toEqual([]);
	});

	it('empty graph uses 0 colors', () => {
		const g = emptyGraph(0);
		const result = backtracking(g, { algorithm: 'backtracking', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(0);
		expect(result.conflicts).toEqual([]);
	});

	it('isolated nodes use 1 color', () => {
		const g = emptyGraph(5);
		const result = backtracking(g, { algorithm: 'backtracking', availableColors: TEST_COLORS });
		expect(result.colorCount).toBe(1);
		expect(result.conflicts).toEqual([]);
	});

	it('respects fixed assignments', () => {
		const g = createGraph();
		addEdge(g, 'a', 'b');
		const fixed = new Map([['a', 3]]);
		const result = backtracking(g, {
			algorithm: 'backtracking',
			availableColors: TEST_COLORS,
			fixedAssignments: fixed,
		});
		expect(result.assignment.get('a')).toBe(3);
		expect(result.conflicts).toEqual([]);
	});

	it('respects timeout on larger graph', () => {
		const g = createGraph();
		for (let i = 0; i < 30; i++) addNode(g, `n${i}`);
		for (let i = 0; i < 30; i++) {
			for (let j = i + 1; j < 30; j++) {
				addEdge(g, `n${i}`, `n${j}`);
			}
		}
		const result = backtracking(g, {
			algorithm: 'backtracking',
			availableColors: TEST_COLORS,
			timeout: 50,
		});
		expect(result.timeMs).toBeDefined();
		expect(result.assignment.size).toBeGreaterThan(0);
	});
});
