import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';
import { pushState } from './history.svelte.js';

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
	ispSpeed: 0 as number, // 0 = no limit
	targetThroughput: 50 as number, // default 50 Mbps minimum
	walls: [] as Array<{
		x1: number;
		y1: number;
		x2: number;
		y2: number;
		thickness: number;
		material: string;
		attenuation: number;
	}>
});

export function addAp(x: number, y: number): AccessPoint {
	pushState();
	const ap: AccessPoint = {
		id: createId(),
		name: `AP-${nextApNumber++}`,
		x,
		y,
		band: projectState.band,
		channelWidth: projectState.channelWidth,
		fixedChannel: null,
		assignedChannel: null,
		interferenceRadius: 150,
		power: 20
	};
	projectState.aps.push(ap);
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
	}
}

export function removeAps(ids: string[]): void {
	pushState();
	const idSet = new Set(ids);
	projectState.aps = projectState.aps.filter((ap) => !idSet.has(ap.id));
	// Reset AP counter when all APs are removed
	if (projectState.aps.length === 0) {
		nextApNumber = 1;
	}
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
