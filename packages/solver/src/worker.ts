/// <reference lib="webworker" />

import { greedy } from './algorithms/greedy.js';
import { dsatur } from './algorithms/dsatur.js';
import { welshPowell } from './algorithms/welsh-powell.js';
import { backtracking } from './algorithms/backtracking.js';
import { compareAll } from './comparator.js';
import type { Graph, SolverOptions, SolverResult } from './types.js';

interface SolveMessage {
	type: 'solve';
	graph: { nodes: string[]; edges: [string, string[]][] };
	options: {
		algorithm: SolverOptions['algorithm'];
		availableColors: number[];
		fixedAssignments?: [string, number][];
		timeout?: number;
	};
}

interface CompareMessage {
	type: 'compare';
	graph: { nodes: string[]; edges: [string, string[]][] };
	options: {
		availableColors: number[];
		fixedAssignments?: [string, number][];
		timeout?: number;
	};
}

function deserializeGraph(data: SolveMessage['graph']): Graph {
	return {
		nodes: data.nodes,
		edges: new Map(data.edges.map(([k, v]) => [k, new Set(v)]))
	};
}

function deserializeOptions(data: SolveMessage['options']): SolverOptions {
	return {
		...data,
		fixedAssignments: data.fixedAssignments ? new Map(data.fixedAssignments) : undefined
	};
}

function serializeResult(result: SolverResult) {
	return {
		...result,
		assignment: Array.from(result.assignment.entries())
	};
}

self.onmessage = (event: MessageEvent<SolveMessage | CompareMessage>) => {
	const { data } = event;
	const graph = deserializeGraph(data.graph);

	if (data.type === 'solve') {
		const options = deserializeOptions(data.options);
		const algorithms = { greedy, dsatur, 'welsh-powell': welshPowell, backtracking };
		const solve = algorithms[options.algorithm];
		const result = solve(graph, options);
		self.postMessage({ type: 'result', data: serializeResult(result) });
	} else if (data.type === 'compare') {
		const options = {
			availableColors: data.options.availableColors,
			fixedAssignments: data.options.fixedAssignments
				? new Map(data.options.fixedAssignments)
				: undefined,
			timeout: data.options.timeout
		};
		const result = compareAll(graph, options);
		self.postMessage({
			type: 'comparison',
			data: {
				results: result.results.map((r) => ({
					...serializeResult(r),
					algorithm: r.algorithm
				}))
			}
		});
	}
};
