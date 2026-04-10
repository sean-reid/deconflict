import { neighbors, degree } from '../graph.js';
import { validate } from '../validator.js';
import type { Graph, SolverOptions, SolverResult } from '../types.js';

export function dsatur(graph: Graph, options: SolverOptions): SolverResult {
	const start = performance.now();
	const assignment = new Map<string, number>();
	const uncolored = new Set(graph.nodes);

	if (options.fixedAssignments) {
		for (const [node, color] of options.fixedAssignments) {
			assignment.set(node, color);
			uncolored.delete(node);
		}
	}

	while (uncolored.size > 0) {
		let bestNode: string | undefined;
		let bestSat = -1;
		let bestDeg = -1;

		for (const node of uncolored) {
			const sat = saturation(graph, node, assignment);
			const deg = degree(graph, node);
			if (
				sat > bestSat ||
				(sat === bestSat && deg > bestDeg) ||
				(sat === bestSat && deg === bestDeg && bestNode !== undefined && graph.nodes.indexOf(node) < graph.nodes.indexOf(bestNode))
			) {
				bestNode = node;
				bestSat = sat;
				bestDeg = deg;
			}
		}

		if (bestNode === undefined) break;

		const neighborColors = new Set<number>();
		for (const nb of neighbors(graph, bestNode)) {
			const c = assignment.get(nb);
			if (c !== undefined) {
				neighborColors.add(c);
			}
		}

		for (const color of options.availableColors) {
			if (!neighborColors.has(color)) {
				assignment.set(bestNode, color);
				break;
			}
		}

		uncolored.delete(bestNode);
	}

	const { conflicts } = validate(graph, assignment);
	const usedColors = new Set(assignment.values());
	const timeMs = performance.now() - start;

	return {
		assignment,
		colorCount: usedColors.size,
		conflicts,
		timeMs,
	};
}

function saturation(graph: Graph, node: string, assignment: Map<string, number>): number {
	const colors = new Set<number>();
	for (const nb of neighbors(graph, node)) {
		const c = assignment.get(nb);
		if (c !== undefined) {
			colors.add(c);
		}
	}
	return colors.size;
}
