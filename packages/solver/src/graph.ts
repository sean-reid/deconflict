import type { Graph } from './types.js';

export function createGraph(): Graph {
	return { nodes: [], edges: new Map() };
}

export function addNode(graph: Graph, id: string): void {
	if (!graph.nodes.includes(id)) {
		graph.nodes.push(id);
	}
	if (!graph.edges.has(id)) {
		graph.edges.set(id, new Set());
	}
}

export function addEdge(graph: Graph, a: string, b: string): void {
	addNode(graph, a);
	addNode(graph, b);
	graph.edges.get(a)!.add(b);
	graph.edges.get(b)!.add(a);
}

export function neighbors(graph: Graph, id: string): string[] {
	const adj = graph.edges.get(id);
	return adj ? Array.from(adj) : [];
}

export function degree(graph: Graph, id: string): number {
	const adj = graph.edges.get(id);
	return adj ? adj.size : 0;
}
