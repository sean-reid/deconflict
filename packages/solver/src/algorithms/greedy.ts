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

		const neighborColorCount = new Map<number, number>();
		for (const nb of neighbors(graph, node)) {
			const c = assignment.get(nb);
			if (c !== undefined) {
				neighborColorCount.set(c, (neighborColorCount.get(c) ?? 0) + 1);
			}
		}

		let assigned = false;
		for (const color of options.availableColors) {
			if (!neighborColorCount.has(color)) {
				assignment.set(node, color);
				assigned = true;
				break;
			}
		}
		if (!assigned && options.availableColors.length > 0) {
			let bestColor = options.availableColors[0]!;
			let least = Infinity;
			for (const color of options.availableColors) {
				const count = neighborColorCount.get(color) ?? 0;
				if (count < least) {
					least = count;
					bestColor = color;
				}
			}
			assignment.set(node, bestColor);
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
