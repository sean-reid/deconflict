import { buildInterferenceGraph } from '@deconflict/geometry';
import { getAvailableChannels, estimateThroughput } from '@deconflict/channels';
import type { ThroughputEstimate, ThroughputInput } from '@deconflict/channels';
import type { Band } from '@deconflict/channels';
import type { SolverResult, ComparisonResult } from '@deconflict/solver';
import { projectState, updateAp, clearAssignments } from './project.svelte.js';
import { appState } from './app.svelte.js';
import { SolverBridge } from '../workers/solver-bridge.js';
import { floorState, getFloorSlabAttenuation } from './floor-state.svelte.js';
import { getEffectiveWupm } from './ap-state.svelte.js';
import { WALL_MATERIALS } from '$canvas/materials.js';
import { rayMarchWallAtten } from '../rf/propagation.js';
import { wallState } from './wall-state.svelte.js';
import { decodeMask } from '$canvas/wall-detect.js';
import { decodeMaterialMask } from '$canvas/wall-labels.js';
import { findModel } from '$lib/data/ap-models.js';

type Algorithm = 'greedy' | 'dsatur' | 'welsh-powell' | 'backtracking';

const bridge = new SolverBridge();

/** Attenuated signal between AP pairs: "apIdA:apIdB" → signal (0-1). */
export const edgeSignals = new Map<string, number>();

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

// ─── Decoded wall mask cache (per floor) ─────────────────────────

interface DecodedFloorMask {
	wallData: Uint8Array;
	materialMap: Uint8Array | null;
	width: number;
	height: number;
	originX: number;
	originY: number;
	sourceKey: string; // for cache invalidation
}

const floorMaskCache = new Map<string, DecodedFloorMask>();

/** Live mask override: set during wall editing so solver skips PNG decode. */
let liveMask: DecodedFloorMask | null = null;

/** Set the live decoded mask during wall editing (call with null when done). */
export function setLiveSolverMask(
	wallData: Uint8Array | null,
	materialData: Uint8Array | null,
	width: number,
	height: number
): void {
	if (wallData) {
		liveMask = {
			wallData,
			materialMap: materialData,
			width,
			height,
			originX: 0,
			originY: 0,
			sourceKey: 'live'
		};
	} else {
		liveMask = null;
	}
}

/** Get decoded wall mask for a floor. Uses current wallState for active floor. */
async function getFloorMask(floorId: string): Promise<DecodedFloorMask | null> {
	const floor = floorState.floors.find((f) => f.id === floorId);

	// During wall editing, use the live decoded mask (no PNG round-trip)
	if (liveMask && floorId === floorState.currentFloorId) {
		return liveMask;
	}

	// For current floor, prefer wallState (always up-to-date) over floor entity (synced on switch)
	if (floorId === floorState.currentFloorId && wallState.wallMask) {
		const wm = wallState.wallMask;
		const key = `${floorId}:${wm.width}x${wm.height}:${wallState.wallMaterial}`;
		const cached = floorMaskCache.get(floorId);
		if (cached && cached.sourceKey === key) return cached;

		const decoded = await decodeMask(wm.dataUrl, wm.width, wm.height);
		const mm = wallState.materialMask;
		const matMask = mm ? await decodeMaterialMask(mm.dataUrl, mm.width, mm.height) : null;
		const entry: DecodedFloorMask = {
			wallData: decoded.data,
			materialMap: matMask,
			width: decoded.width,
			height: decoded.height,
			originX: wm.originX ?? 0,
			originY: wm.originY ?? 0,
			sourceKey: key
		};
		floorMaskCache.set(floorId, entry);
		return entry;
	}

	// Other floors: decode from floor entity
	if (!floor?.wallMask) return null;
	const wm = floor.wallMask;
	const key = `${floorId}:${wm.width}x${wm.height}:${floor.wallMaterial}`;
	const cached = floorMaskCache.get(floorId);
	if (cached && cached.sourceKey === key) return cached;

	const decoded = await decodeMask(wm.dataUrl, wm.width, wm.height);
	const mm = floor.materialMask;
	const matMask = mm ? await decodeMaterialMask(mm.dataUrl, mm.width, mm.height) : null;
	const entry: DecodedFloorMask = {
		wallData: decoded.data,
		materialMap: matMask,
		width: decoded.width,
		height: decoded.height,
		originX: wm.originX ?? 0,
		originY: wm.originY ?? 0,
		sourceKey: key
	};
	floorMaskCache.set(floorId, entry);
	return entry;
}

/** Invalidate mask cache when walls change. */
export function invalidateSolverMaskCache(): void {
	floorMaskCache.clear();
}

// ─── Attenuation helpers ──────────────────────────────────────────

/** Floor-by-ID lookup, built once per solve. */
let floorByIdCache = new Map<string, (typeof floorState.floors)[0]>();

function prepareSortedFloors(): void {
	floorByIdCache = new Map(floorState.floors.map((f) => [f.id, f]));
}

/** Wall attenuation between two APs on the same floor. Uses thickness-aware
 *  mode so drawn wall slabs accumulate dB proportional to their pixel width. */
function getWallLoss(
	mask: DecodedFloorMask,
	ax: number,
	ay: number,
	bx: number,
	by: number,
	defaultMaterial: number,
	wupm: number
): number {
	const matDb = WALL_MATERIALS.map((m) => m.dbPerMeter * m.typicalThickness);
	const defaultDb = WALL_MATERIALS[defaultMaterial]?.attenuation ?? 5;
	const dbPerMeterArr = WALL_MATERIALS.map((m) => m.dbPerMeter);
	const metersPerPixel = wupm > 0 ? 1 / wupm : 0;
	// Convert world coords to mask-local for ray march
	const ox = mask.originX ?? 0;
	const oy = mask.originY ?? 0;
	return rayMarchWallAtten(
		mask.wallData,
		mask.width,
		mask.height,
		mask.materialMap,
		matDb,
		defaultDb,
		ax - ox,
		ay - oy,
		bx - ox,
		by - oy,
		3,
		dbPerMeterArr,
		metersPerPixel,
		defaultMaterial
	);
}

// ─── Graph building ───────────────────────────────────────────────

async function buildSerializedGraph() {
	prepareSortedFloors();
	edgeSignals.clear();
	const aps = getApPositions();
	const apMap = new Map(projectState.aps.map((ap) => [ap.id, ap]));

	const { nodes, edges } = buildInterferenceGraph(aps);

	// Pre-decode wall masks for floors that have APs (parallel decode)
	const apFloorIds = new Set(projectState.aps.map((ap) => ap.floorId));
	const maskPromises = [...apFloorIds].map(async (fid) => [fid, await getFloorMask(fid)] as const);
	const masks = new Map(await Promise.all(maskPromises));

	// Build z-position lookup for O(1) access in the loop
	const apZMap = new Map(aps.map((a) => [a.id, a.z ?? 0]));

	// Filter edges by attenuation: remove edges where signal is too weak
	// dB loss converts to equivalent distance multiplier: 10^(L/40) (inverse quartic)
	const filteredEdges: typeof edges = [];
	for (const edge of edges) {
		const apA = apMap.get(edge.a);
		const apB = apMap.get(edge.b);
		if (!apA || !apB) continue;

		let totalDb = 0;

		if (apA.floorId === apB.floorId) {
			// Same floor: wall attenuation
			const mask = masks.get(apA.floorId);
			if (mask) {
				// Use wallState for current floor (always up-to-date), floor entity for others
				const defMat =
					apA.floorId === floorState.currentFloorId
						? wallState.wallMaterial
						: (floorByIdCache.get(apA.floorId)?.wallMaterial ?? 0);
				totalDb = getWallLoss(mask, apA.x, apA.y, apB.x, apB.y, defMat, getEffectiveWupm());
			}
		} else {
			// Cross-floor: slab attenuation (use worst-case band for conservative estimate)
			totalDb = getFloorSlabAttenuation(apA.floorId, apB.floorId, apA.band as Band);
		}

		// Compute attenuated signal between this AP pair
		const CCI_THRESHOLD = 0.005;
		const dx = apA.x - apB.x;
		const dy = apA.y - apB.y;
		const dz = (apZMap.get(apA.id) ?? 0) - (apZMap.get(apB.id) ?? 0);
		const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
		const r = Math.max(apA.interferenceRadius, apB.interferenceRadius);
		const ratio = dist / r;
		const r4 = ratio * ratio * ratio * ratio;
		const signal = 1 / (1 + r4);
		const attenFactor = totalDb > 0 ? Math.pow(10, -totalDb / 10) : 1;
		const effectiveSignal = signal * attenFactor;

		if (effectiveSignal < CCI_THRESHOLD) continue;

		// Store attenuated signal for UI display
		const pairKey = [apA.id, apB.id].sort().join(':');
		edgeSignals.set(pairKey, effectiveSignal);

		filteredEdges.push(edge);
	}

	// Convert filtered edges to adjacency list format for the worker
	const adjacency = new Map<string, string[]>();
	for (const node of nodes) {
		adjacency.set(node, []);
	}
	for (const edge of filteredEdges) {
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
	const inputs: ThroughputInput[] = projectState.aps.map((ap) => {
		// Use real attenuated signal from edgeSignals (computed during graph build
		// with wall + floor attenuation), not geometric overlap
		const coChannelOverlaps: number[] = [];
		for (const other of projectState.aps) {
			if (other.id === ap.id) continue;
			if (other.assignedChannel !== ap.assignedChannel || ap.assignedChannel === null) continue;
			const pairKey = [ap.id, other.id].sort().join(':');
			const signal = edgeSignals.get(pairKey);
			if (signal !== undefined && signal > 0) {
				coChannelOverlaps.push(signal);
			}
		}
		// Look up model specs for accurate PHY rate
		const model = ap.modelId ? findModel(ap.modelId) : null;
		const bandSpec = model?.bands.find((b) => b.band === ap.band);
		return {
			apId: ap.id,
			band: ap.band,
			channelWidth: ap.channelWidth,
			assignedChannel: ap.assignedChannel,
			coChannelOverlaps,
			wifiStandard: model?.wifiStandard,
			streams: bandSpec?.streams
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
		const graph = await buildSerializedGraph();
		const fixedAssignments = getFixedAssignments();

		// Solve each band independently — different bands don't interfere
		const bands = new Set(projectState.aps.map((ap) => ap.band));
		const mergedAssignment = new Map<string, number>();
		let totalConflicts: [string, string][] = [];
		let totalColors = 0;
		let totalTime = 0;

		for (const band of bands) {
			const bandApIds = new Set(
				projectState.aps.filter((ap) => ap.band === band).map((ap) => ap.id)
			);
			// Filter graph to only this band's APs
			const bandNodes = graph.nodes.filter((id) => bandApIds.has(id));
			const bandEdges = graph.edges
				.filter(([id]) => bandApIds.has(id))
				.map(
					([id, neighbors]) => [id, neighbors.filter((n) => bandApIds.has(n))] as [string, string[]]
				);

			const channels = getAvailableChannels(band as any, projectState.regulatoryDomain);
			const availableColors = channels.map((ch) => ch.number);
			const bandFixed = fixedAssignments.filter(([id]) => bandApIds.has(id));

			const result = await bridge.solve(
				{ nodes: bandNodes, edges: bandEdges },
				{
					algorithm: solverState.algorithm,
					availableColors,
					fixedAssignments: bandFixed.length > 0 ? bandFixed : undefined,
					timeout: 5000
				}
			);

			for (const [id, ch] of result.assignment) mergedAssignment.set(id, ch);
			totalConflicts = [...totalConflicts, ...result.conflicts];
			totalColors += result.colorCount;
			totalTime += result.timeMs;
		}

		solverState.lastResult = {
			assignment: mergedAssignment,
			colorCount: totalColors,
			conflicts: totalConflicts,
			timeMs: totalTime
		};
		solverState.lastTiming = totalTime;
		clearAssignments();
		applyAssignments(mergedAssignment);
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
		const graph = await buildSerializedGraph();
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
