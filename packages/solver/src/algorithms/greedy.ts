import { neighbors } from '../graph.js';
import { validate } from '../validator.js';
import type { Graph, SolverOptions, SolverResult } from '../types.js';

export function greedy(graph: Graph, options: SolverOptions): SolverResult {
	const start = performance.now();
	const assignment = new Map<string, number>();

	if (options.fixedAssignments) {
		for (const [node, color] of options.fixedAssignments) {
			assignment.set(node, color);
		}
	}

	for (const node of graph.nodes) {
		if (assignment.has(node)) continue;

		const neighborColors = new Set<number>();
		for (const nb of neighbors(graph, node)) {
			const c = assignment.get(nb);
			if (c !== undefined) {
				neighborColors.add(c);
			}
		}

		for (const color of options.availableColors) {
			if (!neighborColors.has(color)) {
				assignment.set(node, color);
				break;
			}
		}
	}

	const { conflicts } = validate(graph, assignment);
	const usedColors = new Set(assignment.values());
	const timeMs = performance.now() - start;

	return {
		assignment,
		colorCount: usedColors.size,
		conflicts,
		timeMs
	};
}
