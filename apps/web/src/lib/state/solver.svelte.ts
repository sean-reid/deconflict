import { buildInterferenceGraph } from '@deconflict/geometry';
import { getAvailableChannels, estimateThroughput } from '@deconflict/channels';
import type { ThroughputEstimate, ThroughputInput } from '@deconflict/channels';
import type { SolverResult, ComparisonResult } from '@deconflict/solver';
import { projectState, updateAp, clearAssignments } from './project.svelte.js';
import { appState } from './app.svelte.js';
import { SolverBridge } from '../workers/solver-bridge.js';
import { floorState } from './floor-state.svelte.js';
import { getEffectiveWupm } from './ap-state.svelte.js';

type Algorithm = 'greedy' | 'dsatur' | 'welsh-powell' | 'backtracking';

const bridge = new SolverBridge();

export const solverState = $state({
	algorithm: 'dsatur' as Algorithm,
	isRunning: false,
	lastResult: null as SolverResult | null,
	comparisonResults: null as ComparisonResult | null,
	lastTiming: 0,
	error: null as string | null,
	autoSolve: true,
	throughputEstimates: [] as ThroughputEstimate[]
});

/** Compute cumulative z-position (in world units) for each floor level. */
function getFloorZ(): Map<string, number> {
	const wupm = getEffectiveWupm();
	const sorted = [...floorState.floors].sort((a, b) => a.level - b.level);
	const zMap = new Map<string, number>();
	let z = 0;
	for (const floor of sorted) {
		zMap.set(floor.id, z * wupm);
		z += floor.ceilingHeight;
	}
	return zMap;
}

function getApPositions() {
	const floorZ = getFloorZ();
	return projectState.aps.map((ap) => ({
		id: ap.id,
		x: ap.x,
		y: ap.y,
		z: floorZ.get(ap.floorId) ?? 0,
		interferenceRadius: ap.interferenceRadius
	}));
}

function buildSerializedGraph() {
	const aps = getApPositions();

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
	// Use the most common band among APs, falling back to project default
	const bandCounts = new Map<string, number>();
	for (const ap of projectState.aps) {
		bandCounts.set(ap.band, (bandCounts.get(ap.band) ?? 0) + 1);
	}
	let primaryBand = projectState.band;
	let maxCount = 0;
	for (const [band, count] of bandCounts) {
		if (count > maxCount) {
			maxCount = count;
			primaryBand = band as typeof projectState.band;
		}
	}
	const channels = getAvailableChannels(primaryBand, projectState.regulatoryDomain);
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
	const positions = getApPositions();
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
		// Force Svelte reactivity to see the channel assignment changes
		projectState.aps = [...projectState.aps];
		computeThroughput();
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
		}
	} catch (err) {
		solverState.error = err instanceof Error ? err.message : 'Comparison failed';
	} finally {
		solverState.isRunning = false;
	}
}
