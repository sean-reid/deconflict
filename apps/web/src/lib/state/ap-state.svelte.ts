import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';
import { pushState } from './history.svelte.js';
import { scheduleSave } from './persistence.svelte.js';
import { rangeFromPower } from '../rf/propagation.js';
import { floorplanState } from './floorplan-state.svelte.js';

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

/** Default scale when no floorplan is calibrated (~10 world units per foot). */
export const DEFAULT_WUPM = 10 * 3.28084;

/** Get the effective world-units-per-meter, falling back to the default grid scale. */
export function getEffectiveWupm(): number {
	return floorplanState.calibration?.worldUnitsPerMeter ?? DEFAULT_WUPM;
}

/** Derive interference radius (world units) from TX power and band. */
export function radiusFromPower(power: number, band: string): number {
	const meters = rangeFromPower(power, band);
	return Math.round(meters * getEffectiveWupm());
}

export const apState = $state({
	band: '5ghz' as Band,
	channelWidth: 20 as ChannelWidth,
	regulatoryDomain: 'fcc' as RegulatoryDomain,
	aps: [] as AccessPoint[]
});

export function addAp(x: number, y: number): AccessPoint {
	pushState();
	const prev = apState.aps.length > 0 ? apState.aps[apState.aps.length - 1] : null;

	const ap: AccessPoint = {
		id: createId(),
		name: `AP-${nextApNumber++}`,
		x,
		y,
		band: prev?.band ?? apState.band,
		channelWidth: prev?.channelWidth ?? apState.channelWidth,
		fixedChannel: null,
		assignedChannel: null,
		interferenceRadius:
			prev?.interferenceRadius ?? radiusFromPower(prev?.power ?? 20, prev?.band ?? apState.band),
		power: prev?.power ?? 20,
		modelId: prev?.modelId ?? null,
		modelLabel: prev?.modelLabel ?? null
	};
	apState.aps.push(ap);
	scheduleSave();
	return ap;
}

export function removeAp(id: string): void {
	const idx = apState.aps.findIndex((ap) => ap.id === id);
	if (idx !== -1) {
		pushState();
		apState.aps.splice(idx, 1);
		if (apState.aps.length === 0) {
			nextApNumber = 1;
		}
		scheduleSave();
	}
}

export function removeAps(ids: string[]): void {
	pushState();
	const idSet = new Set(ids);
	apState.aps = apState.aps.filter((ap) => !idSet.has(ap.id));
	if (apState.aps.length === 0) {
		nextApNumber = 1;
	}
	scheduleSave();
}

export function updateAp(id: string, changes: Partial<AccessPoint>): void {
	const ap = apState.aps.find((a) => a.id === id);
	if (ap) {
		Object.assign(ap, changes);
	}
}

export function beginMove(): void {
	pushState();
}

export function moveAp(id: string, x: number, y: number): void {
	const ap = apState.aps.find((a) => a.id === id);
	if (ap) {
		ap.x = x;
		ap.y = y;
	}
}

export function clearAssignments(): void {
	for (const ap of apState.aps) {
		ap.assignedChannel = null;
	}
}

/** Reset AP numbering (called on project clear). */
export function resetApNumbering(): void {
	nextApNumber = 1;
}
