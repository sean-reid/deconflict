import { apState, resetApNumbering } from './ap-state.svelte.js';
import { floorplanState } from './floorplan-state.svelte.js';
import { wallState } from './wall-state.svelte.js';
import { projectMeta } from './project-meta.svelte.js';
import { floorState, type Floor } from './floor-state.svelte.js';
import { clearHistory } from './history.svelte.js';
import type { AccessPoint } from './ap-state.svelte.js';
import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';
import type { WallMaterialId } from '$canvas/materials.js';
import type { FloorMaterialId } from '$canvas/floor-materials.js';

const STORAGE_KEY = 'deconflict:project';
const FLOORPLAN_KEY = 'deconflict:floorplan';
const SAVE_DELAY = 2000;

// v2 (legacy single-floor)
interface SavedStateV2 {
	version: 2;
	name: string;
	band: Band;
	channelWidth: ChannelWidth;
	regulatoryDomain: RegulatoryDomain;
	aps: Omit<AccessPoint, 'floorId'>[];
	floorplanScale: number;
	unitSystem?: 'imperial' | 'metric';
	ispSpeed: number;
	targetThroughput: number;
	wallMask?: {
		dataUrl: string;
		width: number;
		height: number;
		originX?: number;
		originY?: number;
	} | null;
	wallAttenuation?: number;
	wallMaterial?: number;
	materialMask?: {
		dataUrl: string;
		width: number;
		height: number;
		originX?: number;
		originY?: number;
	} | null;
	floorplanBoundary?: Array<{ x: number; y: number }> | null;
	calibration: { worldUnitsPerMeter: number } | null;
}

// v3 (multi-floor)
interface SavedFloor {
	id: string;
	name: string;
	level: number;
	ceilingHeight: number;
	floorMaterial: FloorMaterialId;
	floorThickness: number;
	floorplanScale: number;
	calibration: { worldUnitsPerMeter: number } | null;
	floorplanBoundary: Array<{ x: number; y: number }> | null;
	wallMask: {
		dataUrl: string;
		width: number;
		height: number;
		originX?: number;
		originY?: number;
	} | null;
	wallAttenuation: number;
	wallMaterial: number;
	materialMask: {
		dataUrl: string;
		width: number;
		height: number;
		originX?: number;
		originY?: number;
	} | null;
	roomTypeMask?: {
		dataUrl: string;
		width: number;
		height: number;
		originX?: number;
		originY?: number;
	} | null;
	roomDensityOverrides?: Record<string, number>;
	roomCustomLabels?: Record<string, string>;
}

interface SavedStateV3 {
	version: 3;
	name: string;
	band: Band;
	channelWidth: ChannelWidth;
	regulatoryDomain: RegulatoryDomain;
	unitSystem: 'imperial' | 'metric';
	ispSpeed: number;
	targetThroughput: number;
	floors: SavedFloor[];
	aps: AccessPoint[];
}

type SavedState = SavedStateV2 | SavedStateV3;

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
export const persistenceState = $state({ lastSaved: null as Date | null });

function syncCurrentFloorFromLegacy(): void {
	const cur = floorState.floors.find((f) => f.id === floorState.currentFloorId);
	if (!cur) return;
	cur.floorplanUrl = floorplanState.floorplanUrl;
	cur.floorplanScale = floorplanState.floorplanScale;
	cur.calibration = floorplanState.calibration;
	cur.floorplanBoundary = floorplanState.floorplanBoundary;
	cur.wallMask = wallState.wallMask;
	cur.wallAttenuation = wallState.wallAttenuation;
	cur.wallMaterial = wallState.wallMaterial;
	cur.materialMask = wallState.materialMask;
	cur.roomTypeMask = wallState.roomTypeMask;
}

function saveToStorage(): void {
	syncCurrentFloorFromLegacy();
	try {
		const data: SavedStateV3 = {
			version: 3,
			name: projectMeta.name,
			band: apState.band,
			channelWidth: apState.channelWidth,
			regulatoryDomain: apState.regulatoryDomain,
			unitSystem: floorplanState.unitSystem,
			ispSpeed: projectMeta.ispSpeed,
			targetThroughput: projectMeta.targetThroughput,
			floors: floorState.floors.map((f) => ({
				id: f.id,
				name: f.name,
				level: f.level,
				ceilingHeight: f.ceilingHeight,
				floorMaterial: f.floorMaterial,
				floorThickness: f.floorThickness,
				floorplanScale: f.floorplanScale,
				calibration: f.calibration ? JSON.parse(JSON.stringify(f.calibration)) : null,
				floorplanBoundary: f.floorplanBoundary
					? JSON.parse(JSON.stringify(f.floorplanBoundary))
					: null,
				wallMask: f.wallMask ? JSON.parse(JSON.stringify(f.wallMask)) : null,
				wallAttenuation: f.wallAttenuation,
				wallMaterial: f.wallMaterial,
				materialMask: f.materialMask ? JSON.parse(JSON.stringify(f.materialMask)) : null,
				roomTypeMask: f.roomTypeMask ? JSON.parse(JSON.stringify(f.roomTypeMask)) : null,
				roomDensityOverrides: f.roomDensityOverrides ?? {},
				roomCustomLabels: f.roomCustomLabels ?? {}
			})),
			aps: JSON.parse(JSON.stringify(apState.aps))
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		persistenceState.lastSaved = new Date();
	} catch {
		// localStorage might be full or unavailable
	}

	// Persist floorplan images per floor
	try {
		for (const floor of floorState.floors) {
			if (floor.floorplanUrl && floor.floorplanUrl.startsWith('blob:')) {
				const key = `${FLOORPLAN_KEY}:${floor.id}`;
				const canvas = document.createElement('canvas');
				const img = new Image();
				img.onload = () => {
					canvas.width = img.naturalWidth;
					canvas.height = img.naturalHeight;
					const ctx = canvas.getContext('2d')!;
					ctx.drawImage(img, 0, 0);
					try {
						localStorage.setItem(key, canvas.toDataURL('image/png'));
					} catch {
						// too large
					}
				};
				img.src = floor.floorplanUrl;
			}
		}
	} catch {
		// Ignore
	}
}

/** Migrate v2 (single floor) to v3 (multi-floor). */
function migrateV2(data: SavedStateV2): SavedStateV3 {
	const floorId = crypto.randomUUID();
	return {
		version: 3,
		name: data.name || 'Untitled Project',
		band: data.band || '5ghz',
		channelWidth: data.channelWidth || 20,
		regulatoryDomain: data.regulatoryDomain || 'fcc',
		unitSystem: data.unitSystem ?? 'imperial',
		ispSpeed: data.ispSpeed ?? 0,
		targetThroughput: data.targetThroughput ?? 25,
		floors: [
			{
				id: floorId,
				name: 'Floor 1',
				level: 0,
				ceilingHeight: 3.0,
				floorMaterial: 1,
				floorplanScale: data.floorplanScale ?? 0.4,
				floorThickness: 0.2,
				calibration: data.calibration ?? null,
				floorplanBoundary: data.floorplanBoundary ?? null,
				wallMask: data.wallMask
					? {
							...data.wallMask,
							originX: data.wallMask.originX ?? 0,
							originY: data.wallMask.originY ?? 0
						}
					: null,
				wallAttenuation: data.wallAttenuation ?? 5,
				wallMaterial: data.wallMaterial ?? 0,
				materialMask: data.materialMask
					? {
							...data.materialMask,
							originX: data.materialMask.originX ?? 0,
							originY: data.materialMask.originY ?? 0
						}
					: null,
				roomTypeMask: null,
				roomDensityOverrides: {},
				roomCustomLabels: {}
			}
		],
		aps: (data.aps || []).map((ap) => ({
			...ap,
			floorId,
			modelId: (ap as any).modelId ?? null,
			modelLabel: (ap as any).modelLabel ?? null
		})) as AccessPoint[]
	};
}

export function restoreFromStorage(): boolean {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return false;

		let parsed: SavedState = JSON.parse(raw);
		if (!parsed.version || parsed.version < 2) {
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(FLOORPLAN_KEY);
			return false;
		}

		// Migrate v2 → v3
		const data: SavedStateV3 = parsed.version === 2 ? migrateV2(parsed) : parsed;

		if (!data.floors || data.floors.length === 0) return false;

		// Project meta
		projectMeta.name = data.name || 'Untitled Project';
		projectMeta.ispSpeed = data.ispSpeed ?? 0;
		projectMeta.targetThroughput = data.targetThroughput ?? 25;

		// AP defaults
		apState.band = data.band || '5ghz';
		apState.channelWidth = data.channelWidth || 20;
		apState.regulatoryDomain = data.regulatoryDomain || 'fcc';
		apState.aps = data.aps || [];

		// Unit system (global)
		floorplanState.unitSystem = data.unitSystem ?? 'imperial';

		// Floors
		floorState.floors = data.floors.map((f) => ({
			id: f.id,
			name: f.name,
			level: f.level,
			ceilingHeight: f.ceilingHeight ?? 3.0,
			floorMaterial: (f.floorMaterial ?? 1) as FloorMaterialId,
			floorThickness: (f as any).floorThickness ?? 0.2,
			floorplanUrl: null,
			floorplanScale: f.floorplanScale ?? 0.4,
			calibration: f.calibration ?? null,
			floorplanBoundary: f.floorplanBoundary ?? null,
			wallMask: f.wallMask
				? { ...f.wallMask, originX: f.wallMask.originX ?? 0, originY: f.wallMask.originY ?? 0 }
				: null,
			wallAttenuation: f.wallAttenuation ?? 5,
			wallMaterial: (f.wallMaterial ?? 0) as WallMaterialId,
			materialMask: f.materialMask
				? {
						...f.materialMask,
						originX: f.materialMask.originX ?? 0,
						originY: f.materialMask.originY ?? 0
					}
				: null,
			roomTypeMask: f.roomTypeMask
				? {
						...f.roomTypeMask,
						originX: f.roomTypeMask.originX ?? 0,
						originY: f.roomTypeMask.originY ?? 0
					}
				: null,
			roomDensityOverrides: (f as any).roomDensityOverrides ?? {},
			roomCustomLabels: (f as any).roomCustomLabels ?? {}
		}));
		floorState.currentFloorId = floorState.floors[0]!.id;

		// Sync current floor to legacy atoms (for backward compat with components not yet migrated)
		const cur = floorState.floors[0]!;
		floorplanState.floorplanScale = cur.floorplanScale;
		floorplanState.floorplanBoundary = cur.floorplanBoundary;
		floorplanState.calibration = cur.calibration;
		wallState.wallMask = cur.wallMask;
		wallState.wallAttenuation = cur.wallAttenuation;
		wallState.wallMaterial = cur.wallMaterial;
		wallState.materialMask = cur.materialMask;
		wallState.roomTypeMask = cur.roomTypeMask;

		// Restore floorplan images
		for (const floor of floorState.floors) {
			const perFloorKey = `${FLOORPLAN_KEY}:${floor.id}`;
			const perFloorData = localStorage.getItem(perFloorKey);
			if (perFloorData) {
				floor.floorplanUrl = perFloorData;
			}
		}
		// Legacy: single floorplan key (v2 migration)
		if (!floorState.floors[0]!.floorplanUrl) {
			const legacyFloorplan = localStorage.getItem(FLOORPLAN_KEY);
			if (legacyFloorplan) {
				floorState.floors[0]!.floorplanUrl = legacyFloorplan;
			}
		}
		// Sync to legacy atom
		floorplanState.floorplanUrl = floorState.floors[0]!.floorplanUrl;

		clearHistory();
		return true;
	} catch {
		return false;
	}
}

export function clearSavedState(): void {
	localStorage.removeItem(STORAGE_KEY);
	localStorage.removeItem(FLOORPLAN_KEY);
	// Clear per-floor floorplan keys
	for (const floor of floorState.floors) {
		localStorage.removeItem(`${FLOORPLAN_KEY}:${floor.id}`);
	}
	persistenceState.lastSaved = null;
}

export function scheduleSave(): void {
	if (saveTimeout) clearTimeout(saveTimeout);
	saveTimeout = setTimeout(saveToStorage, SAVE_DELAY);
}

export function hasSavedState(): boolean {
	return localStorage.getItem(STORAGE_KEY) !== null;
}
