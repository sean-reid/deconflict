import { describe, it, expect } from 'vitest';
import { validate } from '../src/validator.js';
import { createGraph, addEdge } from '../src/graph.js';

describe('validator', () => {
	it('valid coloring returns valid true and no conflicts', () => {
		const g = createGraph();
		addEdge(g, 'a', 'b');
		addEdge(g, 'b', 'c');
		const assignment = new Map([
			['a', 1],
			['b', 2],
			['c', 1]
		]);
		const result = validate(g, assignment);
		expect(result.valid).toBe(true);
		expect(result.conflicts).toEqual([]);
	});

	it('single conflict detected correctly', () => {
		const g = createGraph();
		addEdge(g, 'a', 'b');
		const assignment = new Map([
			['a', 1],
			['b', 1]
		]);
		const result = validate(g, assignment);
		expect(result.valid).toBe(false);
		expect(result.conflicts).toHaveLength(1);
		expect(result.conflicts[0]).toEqual(['a', 'b']);
	});

	it('multiple conflicts all reported', () => {
		const g = createGraph();
		addEdge(g, 'a', 'b');
		addEdge(g, 'b', 'c');
		addEdge(g, 'a', 'c');
		const assignment = new Map([
			['a', 1],
			['b', 1],
			['c', 1]
		]);
		const result = validate(g, assignment);
		expect(result.valid).toBe(false);
		expect(result.conflicts).toHaveLength(3);
	});

	it('unassigned nodes do not produce conflicts', () => {
		const g = createGraph();
		addEdge(g, 'a', 'b');
		const assignment = new Map([['a', 1]]);
		const result = validate(g, assignment);
		expect(result.valid).toBe(true);
		expect(result.conflicts).toEqual([]);
	});
});
