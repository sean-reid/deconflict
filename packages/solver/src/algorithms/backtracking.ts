import { neighbors } from '../graph.js';
import { greedy } from './greedy.js';
import { validate } from '../validator.js';
import type { Graph, SolverOptions, SolverResult } from '../types.js';

export function backtracking(graph: Graph, options: SolverOptions): SolverResult {
	const start = performance.now();
	const timeout = options.timeout ?? 5000;
	const deadline = start + timeout;

	if (graph.nodes.length === 0) {
		return {
			assignment: new Map(),
			colorCount: 0,
			conflicts: [],
			timeMs: performance.now() - start,
		};
	}

	const greedyResult = greedy(graph, { ...options, algorithm: 'greedy' });
	let bestAssignment = greedyResult.assignment;
	let bestK = greedyResult.colorCount;

	for (let k = 1; k < bestK; k++) {
		if (performance.now() > deadline) break;

		const colors = options.availableColors.slice(0, k);
		const assignment = new Map<string, number>();
		const domains = new Map<string, Set<number>>();

		for (const node of graph.nodes) {
			if (options.fixedAssignments?.has(node)) {
				const fixedColor = options.fixedAssignments.get(node)!;
				assignment.set(node, fixedColor);
				domains.set(node, new Set([fixedColor]));
			} else {
				domains.set(node, new Set(colors));
			}
		}

		let fixedValid = true;
		if (options.fixedAssignments) {
			for (const [node, color] of options.fixedAssignments) {
				if (!colors.includes(color)) {
					fixedValid = false;
					break;
				}
				for (const nb of neighbors(graph, node)) {
					const nbDomain = domains.get(nb);
					if (nbDomain) {
						nbDomain.delete(color);
						if (nbDomain.size === 0 && !assignment.has(nb)) {
							fixedValid = false;
							break;
						}
					}
				}
				if (!fixedValid) break;
			}
		}
		if (!fixedValid) continue;

		const result = solve(graph, options, assignment, domains, 0, deadline);
		if (result) {
			bestAssignment = result;
			bestK = k;
		}
	}

	const { conflicts } = validate(graph, bestAssignment);
	const usedColors = new Set(bestAssignment.values());

	return {
		assignment: bestAssignment,
		colorCount: usedColors.size,
		conflicts,
		timeMs: performance.now() - start,
	};
}

function solve(
	graph: Graph,
	options: SolverOptions,
	assignment: Map<string, number>,
	domains: Map<string, Set<number>>,
	index: number,
	deadline: number,
): Map<string, number> | null {
	if (performance.now() > deadline) return null;

	const uncolored = graph.nodes.filter(n => !assignment.has(n));
	if (uncolored.length === 0) {
		return new Map(assignment);
	}

	let best: string | undefined;
	let bestSize = Infinity;
	for (const node of uncolored) {
		const d = domains.get(node);
		const size = d ? d.size : 0;
		if (size < bestSize) {
			bestSize = size;
			best = node;
		}
	}

	if (best === undefined || bestSize === 0) return null;

	const domain = domains.get(best);
	if (!domain) return null;

	for (const color of domain) {
		if (performance.now() > deadline) return null;

		assignment.set(best, color);

		const pruned: [string, number][] = [];
		let valid = true;

		for (const nb of neighbors(graph, best)) {
			if (assignment.has(nb)) continue;
			const nbDomain = domains.get(nb);
			if (nbDomain && nbDomain.has(color)) {
				nbDomain.delete(color);
				pruned.push([nb, color]);
				if (nbDomain.size === 0) {
					valid = false;
					break;
				}
			}
		}

		if (valid) {
			const result = solve(graph, options, assignment, domains, index + 1, deadline);
			if (result) return result;
		}

		for (const [nb, c] of pruned) {
			domains.get(nb)?.add(c);
		}
		assignment.delete(best);
	}

	return null;
}
