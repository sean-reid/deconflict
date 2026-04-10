import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';

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
	floorplanScale: 1
});

export function addAp(x: number, y: number): AccessPoint {
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
		projectState.aps.splice(idx, 1);
	}
}

export function removeAps(ids: string[]): void {
	const idSet = new Set(ids);
	projectState.aps = projectState.aps.filter((ap) => !idSet.has(ap.id));
}

export function updateAp(id: string, changes: Partial<AccessPoint>): void {
	const ap = projectState.aps.find((a) => a.id === id);
	if (ap) {
		Object.assign(ap, changes);
	}
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

export function getAp(id: string): AccessPoint | undefined {
	return projectState.aps.find((a) => a.id === id);
}
