import type { Graph } from './types.js';

export function validate(
	graph: Graph,
	assignment: Map<string, number>,
): { valid: boolean; conflicts: [string, string][] } {
	const conflicts: [string, string][] = [];

	for (const [node, adj] of graph.edges) {
		for (const neighbor of adj) {
			if (node < neighbor) {
				const colorA = assignment.get(node);
				const colorB = assignment.get(neighbor);
				if (colorA !== undefined && colorB !== undefined && colorA === colorB) {
					conflicts.push([node, neighbor]);
				}
			}
		}
	}

	return { valid: conflicts.length === 0, conflicts };
}
