import { neighbors, degree } from '../graph.js';
import { validate } from '../validator.js';
import type { Graph, SolverOptions, SolverResult } from '../types.js';

export function dsatur(graph: Graph, options: SolverOptions): SolverResult {
	const start = performance.now();
	const assignment = new Map<string, number>();
	const uncolored = new Set(graph.nodes);
	const nodeIndex = new Map(graph.nodes.map((n, i) => [n, i]));

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
				(sat === bestSat &&
					deg === bestDeg &&
					bestNode !== undefined &&
					(nodeIndex.get(node) ?? 0) < (nodeIndex.get(bestNode) ?? 0))
			) {
				bestNode = node;
				bestSat = sat;
				bestDeg = deg;
			}
		}

		if (bestNode === undefined) break;

		// Count how many neighbors use each color
		const neighborColorCount = new Map<number, number>();
		for (const nb of neighbors(graph, bestNode)) {
			const c = assignment.get(nb);
			if (c !== undefined) {
				neighborColorCount.set(c, (neighborColorCount.get(c) ?? 0) + 1);
			}
		}

		// Pick the first conflict-free color
		let assigned = false;
		for (const color of options.availableColors) {
			if (!neighborColorCount.has(color)) {
				assignment.set(bestNode, color);
				assigned = true;
				break;
			}
		}

		// No conflict-free color: pick the one with least neighbor usage (minimize contention)
		if (!assigned && options.availableColors.length > 0) {
			let bestColor = options.availableColors[0]!;
			let leastConflicts = Infinity;
			for (const color of options.availableColors) {
				const count = neighborColorCount.get(color) ?? 0;
				if (count < leastConflicts) {
					leastConflicts = count;
					bestColor = color;
				}
			}
			assignment.set(bestNode, bestColor);
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
		timeMs
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
