import { greedy } from './algorithms/greedy.js';
import { dsatur } from './algorithms/dsatur.js';
import { welshPowell } from './algorithms/welsh-powell.js';
import { backtracking } from './algorithms/backtracking.js';
import type { Graph, SolverOptions, SolverResult, ComparisonResult } from './types.js';

const ALGORITHMS = [
	{ name: 'greedy' as const, fn: greedy },
	{ name: 'dsatur' as const, fn: dsatur },
	{ name: 'welsh-powell' as const, fn: welshPowell },
	{ name: 'backtracking' as const, fn: backtracking }
];

export function compareAll(
	graph: Graph,
	options: Omit<SolverOptions, 'algorithm'>
): ComparisonResult {
	const results: Array<SolverResult & { algorithm: string }> = [];

	for (const { name, fn } of ALGORITHMS) {
		const result = fn(graph, { ...options, algorithm: name });
		results.push({ ...result, algorithm: name });
	}

	results.sort((a, b) => {
		if (a.colorCount !== b.colorCount) return a.colorCount - b.colorCount;
		return a.timeMs - b.timeMs;
	});

	return { results };
}
