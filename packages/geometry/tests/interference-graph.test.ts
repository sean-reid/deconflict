import { describe, it, expect } from 'vitest';
import { buildInterferenceGraph } from '../src/interference-graph.js';
import type { ApPosition } from '../src/interference-graph.js';

describe('buildInterferenceGraph', () => {
	it('creates edges only between APs whose interference circles overlap', () => {
		const aps: ApPosition[] = [
			{ id: 'A', x: 0, y: 0, interferenceRadius: 100 },
			{ id: 'B', x: 150, y: 0, interferenceRadius: 100 },
			{ id: 'C', x: 300, y: 0, interferenceRadius: 100 }
		];

		const graph = buildInterferenceGraph(aps);
		expect(graph.nodes).toEqual(['A', 'B', 'C']);
		expect(graph.edges).toHaveLength(2);

		const edgeAB = graph.edges.find((e) => e.a === 'A' && e.b === 'B');
		const edgeBC = graph.edges.find((e) => e.a === 'B' && e.b === 'C');
		expect(edgeAB).toBeDefined();
		expect(edgeBC).toBeDefined();
		expect(edgeAB!.overlapFraction).toBeGreaterThan(0);
		expect(edgeAB!.overlapFraction).toBeLessThanOrEqual(1);

		// A and C are too far apart (distance=300, radii sum=200)
		const edgeAC = graph.edges.find((e) => e.a === 'A' && e.b === 'C');
		expect(edgeAC).toBeUndefined();
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

	it('creates an edge with overlapFraction=1 for two APs at the same position', () => {
		const aps: ApPosition[] = [
			{ id: 'A', x: 0, y: 0, interferenceRadius: 10 },
			{ id: 'B', x: 0, y: 0, interferenceRadius: 10 }
		];

		const graph = buildInterferenceGraph(aps);
		expect(graph.edges).toHaveLength(1);
		expect(graph.edges[0]!.overlapFraction).toBe(1);
	});

	it('returns higher overlapFraction for closer APs', () => {
		const aps: ApPosition[] = [
			{ id: 'A', x: 0, y: 0, interferenceRadius: 100 },
			{ id: 'B', x: 50, y: 0, interferenceRadius: 100 },  // close to A
			{ id: 'C', x: 180, y: 0, interferenceRadius: 100 }  // far from A (barely overlapping)
		];

		const graph = buildInterferenceGraph(aps);
		const edgeAB = graph.edges.find((e) => e.a === 'A' && e.b === 'B');
		const edgeAC = graph.edges.find((e) => e.a === 'A' && e.b === 'C');
		expect(edgeAB).toBeDefined();
		expect(edgeAC).toBeDefined();
		// Closer APs should have a higher overlap fraction
		expect(edgeAB!.overlapFraction).toBeGreaterThan(edgeAC!.overlapFraction);
	});

	it('computes correct overlapFraction for known distances', () => {
		// Two APs, each with radius 100, distance apart = 100
		// overlap = 200 - 100 = 100, minRadius = 100, fraction = 100/100 = 1.0
		const aps: ApPosition[] = [
			{ id: 'A', x: 0, y: 0, interferenceRadius: 100 },
			{ id: 'B', x: 100, y: 0, interferenceRadius: 100 }
		];

		const graph = buildInterferenceGraph(aps);
		expect(graph.edges).toHaveLength(1);
		expect(graph.edges[0]!.overlapFraction).toBe(1);
	});

	it('caps overlapFraction at 1 for asymmetric radii', () => {
		// Small AP fully inside a large AP
		// radii: 200+10=210, dist=0, overlap=210, minRadius=10, fraction=210/10=21 -> capped to 1
		const aps: ApPosition[] = [
			{ id: 'A', x: 0, y: 0, interferenceRadius: 200 },
			{ id: 'B', x: 0, y: 0, interferenceRadius: 10 }
		];

		const graph = buildInterferenceGraph(aps);
		expect(graph.edges).toHaveLength(1);
		expect(graph.edges[0]!.overlapFraction).toBe(1);
	});
});
