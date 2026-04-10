import { describe, it, expect } from 'vitest';
import { createGraph, addNode, addEdge, neighbors, degree } from '../src/graph.js';

describe('graph utilities', () => {
	it('createGraph returns an empty graph', () => {
		const g = createGraph();
		expect(g.nodes).toEqual([]);
		expect(g.edges.size).toBe(0);
	});

	it('addNode adds a node', () => {
		const g = createGraph();
		addNode(g, 'a');
		expect(g.nodes).toEqual(['a']);
		expect(g.edges.has('a')).toBe(true);
		expect(g.edges.get('a')!.size).toBe(0);
	});

	it('duplicate addNode is idempotent', () => {
		const g = createGraph();
		addNode(g, 'a');
		addNode(g, 'a');
		expect(g.nodes).toEqual(['a']);
	});

	it('addEdge creates bidirectional edge and auto-adds nodes', () => {
		const g = createGraph();
		addEdge(g, 'a', 'b');
		expect(g.nodes).toContain('a');
		expect(g.nodes).toContain('b');
		expect(g.edges.get('a')!.has('b')).toBe(true);
		expect(g.edges.get('b')!.has('a')).toBe(true);
	});

	it('neighbors returns correct list', () => {
		const g = createGraph();
		addEdge(g, 'a', 'b');
		addEdge(g, 'a', 'c');
		expect(neighbors(g, 'a').sort()).toEqual(['b', 'c']);
		expect(neighbors(g, 'b')).toEqual(['a']);
	});

	it('neighbors returns empty array for unknown node', () => {
		const g = createGraph();
		expect(neighbors(g, 'z')).toEqual([]);
	});

	it('degree returns correct value', () => {
		const g = createGraph();
		addEdge(g, 'a', 'b');
		addEdge(g, 'a', 'c');
		addEdge(g, 'a', 'd');
		expect(degree(g, 'a')).toBe(3);
		expect(degree(g, 'b')).toBe(1);
	});

	it('degree returns 0 for unknown node', () => {
		const g = createGraph();
		expect(degree(g, 'z')).toBe(0);
	});
});
