import { buildInterferenceGraph } from '@deconflict/geometry';
import { getAvailableChannels, estimateThroughput } from '@deconflict/channels';
import type { ThroughputEstimate, ThroughputInput } from '@deconflict/channels';
import type { SolverResult, ComparisonResult } from '@deconflict/solver';
import { projectState, updateAp, clearAssignments } from './project.svelte.js';
import { appState } from './app.svelte.js';
import { SolverBridge } from '../workers/solver-bridge.js';

type Algorithm = 'greedy' | 'dsatur' | 'welsh-powell' | 'backtracking';

const bridge = new SolverBridge();

export const solverState = $state({
	algorithm: 'dsatur' as Algorithm,
	isRunning: false,
	lastResult: null as SolverResult | null,
	comparisonResults: null as ComparisonResult | null,
	lastTiming: 0,
	error: null as string | null,
	autoSolve: false,
	throughputEstimates: [] as ThroughputEstimate[]
});

function buildSerializedGraph() {
	const aps = projectState.aps.map((ap) => ({
		id: ap.id,
		x: ap.x,
		y: ap.y,
		interferenceRadius: ap.interferenceRadius
	}));

	const { nodes, edges } = buildInterferenceGraph(aps);

	// Convert edges to adjacency list format for the worker
	const adjacency = new Map<string, string[]>();
	for (const node of nodes) {
		adjacency.set(node, []);
	}
	for (const edge of edges) {
		adjacency.get(edge.a)?.push(edge.b);
		adjacency.get(edge.b)?.push(edge.a);
	}

	return {
		nodes,
		edges: Array.from(adjacency.entries())
	};
}

function getColorOptions(): number[] {
	const channels = getAvailableChannels(projectState.band, projectState.regulatoryDomain);
	return channels.map((ch) => ch.number);
}

function getFixedAssignments(): [string, number][] {
	const fixed: [string, number][] = [];
	for (const ap of projectState.aps) {
		if (ap.fixedChannel !== null) {
			fixed.push([ap.id, ap.fixedChannel]);
		}
	}
	return fixed;
}

function applyAssignments(assignment: Map<string, number>): void {
	for (const [apId, channel] of assignment) {
		updateAp(apId, { assignedChannel: channel });
	}
}

function computeThroughput(): void {
	const positions = projectState.aps.map((ap) => ({
		id: ap.id,
		x: ap.x,
		y: ap.y,
		interferenceRadius: ap.interferenceRadius
	}));
	const { edges } = buildInterferenceGraph(positions);

	const inputs: ThroughputInput[] = projectState.aps.map((ap) => {
		// Find co-channel APs and their overlap fractions
		const coChannelOverlaps: number[] = [];
		for (const edge of edges) {
			const otherId = edge.a === ap.id ? edge.b : edge.b === ap.id ? edge.a : null;
			if (!otherId) continue;
			const other = projectState.aps.find((a) => a.id === otherId);
			if (other && other.assignedChannel === ap.assignedChannel && ap.assignedChannel !== null) {
				coChannelOverlaps.push(edge.overlapFraction);
			}
		}
		return {
			apId: ap.id,
			band: ap.band,
			channelWidth: ap.channelWidth,
			assignedChannel: ap.assignedChannel,
			coChannelOverlaps
		};
	});

	solverState.throughputEstimates = estimateThroughput(inputs, {
		ispSpeed: projectState.ispSpeed,
		targetThroughput: projectState.targetThroughput
	});
}

export async function runSolver(): Promise<void> {
	if (projectState.aps.length === 0) return;
	if (solverState.isRunning) return;

	solverState.isRunning = true;
	solverState.error = null;

	try {
		const graph = buildSerializedGraph();
		const availableColors = getColorOptions();
		const fixedAssignments = getFixedAssignments();

		const result = await bridge.solve(graph, {
			algorithm: solverState.algorithm,
			availableColors,
			fixedAssignments: fixedAssignments.length > 0 ? fixedAssignments : undefined,
			timeout: 5000
		});

		solverState.lastResult = result;
		solverState.lastTiming = result.timeMs;
		clearAssignments();
		applyAssignments(result.assignment);
		computeThroughput();
		appState.showHeatmap = true;
		appState.sidebarPanel = 'results';
	} catch (err) {
		solverState.error = err instanceof Error ? err.message : 'Solver failed';
	} finally {
		solverState.isRunning = false;
	}
}

export async function runComparison(): Promise<void> {
	if (projectState.aps.length === 0) return;
	if (solverState.isRunning) return;

	solverState.isRunning = true;
	solverState.error = null;

	try {
		const graph = buildSerializedGraph();
		const availableColors = getColorOptions();
		const fixedAssignments = getFixedAssignments();

		const result = await bridge.compare(graph, {
			availableColors,
			fixedAssignments: fixedAssignments.length > 0 ? fixedAssignments : undefined,
			timeout: 5000
		});

		solverState.comparisonResults = result;

		// Apply the best result (fewest colors, fastest time)
		if (result.results.length > 0) {
			const best = result.results[0]!;
			solverState.lastResult = best;
			solverState.lastTiming = best.timeMs;
			solverState.algorithm = best.algorithm as Algorithm;
			clearAssignments();
			applyAssignments(best.assignment);
			computeThroughput();
			appState.showHeatmap = true;
			appState.sidebarPanel = 'results';
		}
	} catch (err) {
		solverState.error = err instanceof Error ? err.message : 'Comparison failed';
	} finally {
		solverState.isRunning = false;
	}
}
