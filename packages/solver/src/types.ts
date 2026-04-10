export interface Graph {
	nodes: string[];
	edges: Map<string, Set<string>>;
}

export interface SolverOptions {
	algorithm: 'greedy' | 'dsatur' | 'welsh-powell' | 'backtracking';
	availableColors: number[];
	fixedAssignments?: Map<string, number>;
	timeout?: number;
}

export interface SolverResult {
	assignment: Map<string, number>;
	colorCount: number;
	conflicts: [string, string][];
	timeMs: number;
}

export interface ComparisonResult {
	results: Array<SolverResult & { algorithm: string }>;
}
