import { neighbors, degree } from '../graph.js';
import { validate } from '../validator.js';
import type { Graph, SolverOptions, SolverResult } from '../types.js';

export function welshPowell(graph: Graph, options: SolverOptions): SolverResult {
	const start = performance.now();
	const assignment = new Map<string, number>();
	const uncolored = new Set(graph.nodes);

	if (options.fixedAssignments) {
		for (const [node, color] of options.fixedAssignments) {
			assignment.set(node, color);
			uncolored.delete(node);
		}
	}

	const sorted = [...graph.nodes].sort((a, b) => degree(graph, b) - degree(graph, a));

	for (const color of options.availableColors) {
		if (uncolored.size === 0) break;

		for (const node of sorted) {
			if (!uncolored.has(node)) continue;

			const hasConflict = neighbors(graph, node).some(nb => assignment.get(nb) === color);
			if (!hasConflict) {
				assignment.set(node, color);
				uncolored.delete(node);
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
		timeMs,
	};
}
