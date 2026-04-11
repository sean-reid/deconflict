import type { SolverResult, ComparisonResult } from '@deconflict/solver';

type Algorithm = 'greedy' | 'dsatur' | 'welsh-powell' | 'backtracking';

interface SerializedGraph {
	nodes: string[];
	edges: [string, string[]][];
}

interface SerializedSolverResult {
	assignment: [string, number][];
	colorCount: number;
	conflicts: [string, string][];
	timeMs: number;
}

function deserializeResult(data: SerializedSolverResult): SolverResult {
	return {
		...data,
		assignment: new Map(data.assignment)
	};
}

export class SolverBridge {
	private worker: Worker | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private pendingResolve: ((value: any) => void) | null = null;
	private pendingReject: ((reason: unknown) => void) | null = null;

	private getWorker(): Worker {
		if (!this.worker) {
			this.worker = new Worker(
				new URL('../../../../../packages/solver/src/worker.ts', import.meta.url),
				{ type: 'module' }
			);
			this.worker.onmessage = (event) => {
				const { data } = event;
				if (data.type === 'result' && this.pendingResolve) {
					this.pendingResolve(deserializeResult(data.data));
					this.pendingResolve = null;
					this.pendingReject = null;
				} else if (data.type === 'comparison' && this.pendingResolve) {
					const results: ComparisonResult = {
						results: data.data.results.map((r: SerializedSolverResult & { algorithm: string }) => ({
							...deserializeResult(r),
							algorithm: r.algorithm
						}))
					};
					this.pendingResolve(results);
					this.pendingResolve = null;
					this.pendingReject = null;
				}
			};
			this.worker.onerror = (err) => {
				if (this.pendingReject) {
					this.pendingReject(err);
					this.pendingResolve = null;
					this.pendingReject = null;
				}
			};
		}
		return this.worker;
	}

	solve(
		graph: SerializedGraph,
		options: {
			algorithm: Algorithm;
			availableColors: number[];
			fixedAssignments?: [string, number][];
			timeout?: number;
		}
	): Promise<SolverResult> {
		return new Promise((resolve, reject) => {
			// Reject any pending request
			if (this.pendingReject) {
				this.pendingReject(new Error('Superseded by new request'));
			}
			this.pendingResolve = resolve;
			this.pendingReject = reject;
			this.getWorker().postMessage({ type: 'solve', graph, options });
		});
	}

	compare(
		graph: SerializedGraph,
		options: {
			availableColors: number[];
			fixedAssignments?: [string, number][];
			timeout?: number;
		}
	): Promise<ComparisonResult> {
		return new Promise((resolve, reject) => {
			// Reject any pending request
			if (this.pendingReject) {
				this.pendingReject(new Error('Superseded by new request'));
			}
			this.pendingResolve = resolve;
			this.pendingReject = reject;
			this.getWorker().postMessage({ type: 'compare', graph, options });
		});
	}

	terminate(): void {
		this.worker?.terminate();
		this.worker = null;
	}
}
