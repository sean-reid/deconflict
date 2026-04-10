import { createGraph, addNode, addEdge } from '../src/graph.js';
import type { Graph } from '../src/types.js';

/** Complete graph K5 (chromatic number = 5) */
export function completeK5(): Graph {
	const g = createGraph();
	const nodes = ['a', 'b', 'c', 'd', 'e'];
	for (const n of nodes) addNode(g, n);
	for (let i = 0; i < nodes.length; i++) {
		for (let j = i + 1; j < nodes.length; j++) {
			addEdge(g, nodes[i]!, nodes[j]!);
		}
	}
	return g;
}

/** Petersen graph (chromatic number = 3) */
export function petersenGraph(): Graph {
	const g = createGraph();
	for (let i = 0; i < 5; i++) addNode(g, `o${i}`);
	for (let i = 0; i < 5; i++) addEdge(g, `o${i}`, `o${(i + 1) % 5}`);
	for (let i = 0; i < 5; i++) addNode(g, `i${i}`);
	for (let i = 0; i < 5; i++) addEdge(g, `i${i}`, `i${(i + 2) % 5}`);
	for (let i = 0; i < 5; i++) addEdge(g, `o${i}`, `i${i}`);
	return g;
}

/** Bipartite graph (chromatic number = 2) */
export function bipartiteGraph(): Graph {
	const g = createGraph();
	for (let i = 0; i < 3; i++) addNode(g, `l${i}`);
	for (let i = 0; i < 3; i++) addNode(g, `r${i}`);
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			addEdge(g, `l${i}`, `r${j}`);
		}
	}
	return g;
}

/** Cycle C5 (chromatic number = 3, odd cycle) */
export function cycleC5(): Graph {
	const g = createGraph();
	for (let i = 0; i < 5; i++) addNode(g, `n${i}`);
	for (let i = 0; i < 5; i++) addEdge(g, `n${i}`, `n${(i + 1) % 5}`);
	return g;
}

/** Empty graph (chromatic number = 1) */
export function emptyGraph(n: number): Graph {
	const g = createGraph();
	for (let i = 0; i < n; i++) addNode(g, `n${i}`);
	return g;
}

/** Standard colors for testing */
export const TEST_COLORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
