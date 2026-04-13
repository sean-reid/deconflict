import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';
import { pushState } from './history.svelte.js';
import { scheduleSave } from './persistence.svelte.js';

export interface AccessPoint {
	id: string;
	name: string;
	x: number;
	y: number;
	band: Band;
	channelWidth: ChannelWidth;
	fixedChannel: number | null;
	assignedChannel: number | null;
	interferenceRadius: number;
	power: number;
	modelId: string | null;
	modelLabel: string | null;
}

let nextApNumber = 1;

function createId(): string {
	return crypto.randomUUID();
}

export const projectState = $state({
	name: 'Untitled Project',
	band: '5ghz' as Band,
	channelWidth: 20 as ChannelWidth,
	regulatoryDomain: 'fcc' as RegulatoryDomain,
	aps: [] as AccessPoint[],
	floorplanUrl: null as string | null,
	floorplanScale: 0.4,
	calibration: null as { worldUnitsPerMeter: number } | null,
	floorplanBoundary: null as Array<{ x: number; y: number }> | null,
	unitSystem: 'imperial' as 'imperial' | 'metric',
	ispSpeed: 0 as number, // 0 = no limit
	targetThroughput: 25 as number, // default 25 Mbps minimum
	wallMask: null as { dataUrl: string; width: number; height: number } | null,
	wallAttenuation: 5 as number, // legacy, used as fallback when no materialMask
	wallMaterial: 0 as import('$canvas/materials.js').WallMaterialId, // global default material
	materialMask: null as { dataUrl: string; width: number; height: number } | null
});

export function addAp(x: number, y: number): AccessPoint {
	pushState();

	// Inherit model, band, width, power, and radius from the last placed AP
	// so users can place multiple of the same vendor/model in a row
	const prev = projectState.aps.length > 0 ? projectState.aps[projectState.aps.length - 1] : null;

	const ap: AccessPoint = {
		id: createId(),
		name: `AP-${nextApNumber++}`,
		x,
		y,
		band: prev?.band ?? projectState.band,
		channelWidth: prev?.channelWidth ?? projectState.channelWidth,
		fixedChannel: null,
		assignedChannel: null,
		interferenceRadius:
			prev?.interferenceRadius ??
			(projectState.calibration
				? Math.round(15 * projectState.calibration.worldUnitsPerMeter)
				: 150),
		power: prev?.power ?? 20,
		modelId: prev?.modelId ?? null,
		modelLabel: prev?.modelLabel ?? null
	};
	projectState.aps.push(ap);
	scheduleSave();
	return ap;
}

export function removeAp(id: string): void {
	const idx = projectState.aps.findIndex((ap) => ap.id === id);
	if (idx !== -1) {
		pushState();
		projectState.aps.splice(idx, 1);
		if (projectState.aps.length === 0) {
			nextApNumber = 1;
		}
		scheduleSave();
	}
}

export function removeAps(ids: string[]): void {
	pushState();
	const idSet = new Set(ids);
	projectState.aps = projectState.aps.filter((ap) => !idSet.has(ap.id));
	if (projectState.aps.length === 0) {
		nextApNumber = 1;
	}
	scheduleSave();
}

export function updateAp(id: string, changes: Partial<AccessPoint>): void {
	const ap = projectState.aps.find((a) => a.id === id);
	if (ap) {
		Object.assign(ap, changes);
	}
}

export function beginMove(): void {
	pushState();
}

export function moveAp(id: string, x: number, y: number): void {
	const ap = projectState.aps.find((a) => a.id === id);
	if (ap) {
		ap.x = x;
		ap.y = y;
	}
}

export function clearAssignments(): void {
	for (const ap of projectState.aps) {
		ap.assignedChannel = null;
	}
}
