import { describe, it, expect } from 'vitest';
import { buildInterferenceGraph } from '../src/interference-graph.js';
import type { ApPosition } from '../src/interference-graph.js';

describe('buildInterferenceGraph', () => {
	it('creates edges only between APs whose interference circles overlap', () => {
		const aps: ApPosition[] = [
			{ id: 'A', x: 0, y: 0, interferenceRadius: 100 },
			{ id: 'B', x: 150, y: 0, interferenceRadius: 100 },
			{ id: 'C', x: 300, y: 0, interferenceRadius: 100 },
		];

		const graph = buildInterferenceGraph(aps);
		expect(graph.nodes).toEqual(['A', 'B', 'C']);
		expect(graph.edges).toContainEqual({ a: 'A', b: 'B' });
		expect(graph.edges).toContainEqual({ a: 'B', b: 'C' });
		expect(graph.edges).not.toContainEqual({ a: 'A', b: 'C' });
		expect(graph.edges).toHaveLength(2);
	});

	it('returns empty graph for 0 APs', () => {
		const graph = buildInterferenceGraph([]);
		expect(graph.nodes).toEqual([]);
		expect(graph.edges).toEqual([]);
	});

	it('returns one node and no edges for 1 AP', () => {
		const graph = buildInterferenceGraph([{ id: 'A', x: 0, y: 0, interferenceRadius: 50 }]);
		expect(graph.nodes).toEqual(['A']);
		expect(graph.edges).toEqual([]);
	});

	it('creates an edge for two APs at the same position', () => {
		const aps: ApPosition[] = [
			{ id: 'A', x: 0, y: 0, interferenceRadius: 10 },
			{ id: 'B', x: 0, y: 0, interferenceRadius: 10 },
		];

		const graph = buildInterferenceGraph(aps);
		expect(graph.edges).toContainEqual({ a: 'A', b: 'B' });
	});
});
