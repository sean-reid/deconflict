import { apState, resetApNumbering } from './ap-state.svelte.js';
import { floorplanState } from './floorplan-state.svelte.js';
import { wallState } from './wall-state.svelte.js';
import { projectMeta } from './project-meta.svelte.js';
import { clearHistory } from './history.svelte.js';
import type { AccessPoint } from './ap-state.svelte.js';
import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';
import type { WallMaterialId } from '$canvas/materials.js';

const STORAGE_KEY = 'deconflict:project';
const FLOORPLAN_KEY = 'deconflict:floorplan';
const SAVE_DELAY = 2000;

interface SavedState {
	version: 2;
	name: string;
	band: Band;
	channelWidth: ChannelWidth;
	regulatoryDomain: RegulatoryDomain;
	aps: AccessPoint[];
	floorplanScale: number;
	unitSystem?: 'imperial' | 'metric';
	ispSpeed: number;
	targetThroughput: number;
	wallMask?: { dataUrl: string; width: number; height: number } | null;
	wallAttenuation?: number;
	wallMaterial?: number;
	materialMask?: { dataUrl: string; width: number; height: number } | null;
	floorplanBoundary?: Array<{ x: number; y: number }> | null;
	calibration: { worldUnitsPerMeter: number } | null;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
export const persistenceState = $state({ lastSaved: null as Date | null });

function saveToStorage(): void {
	try {
		const data: SavedState = {
			version: 2,
			name: projectMeta.name,
			band: apState.band,
			channelWidth: apState.channelWidth,
			regulatoryDomain: apState.regulatoryDomain,
			aps: JSON.parse(JSON.stringify(apState.aps)),
			unitSystem: floorplanState.unitSystem,
			floorplanScale: floorplanState.floorplanScale,
			ispSpeed: projectMeta.ispSpeed,
			targetThroughput: projectMeta.targetThroughput,
			wallMask: wallState.wallMask ? JSON.parse(JSON.stringify(wallState.wallMask)) : null,
			wallAttenuation: wallState.wallAttenuation,
			wallMaterial: wallState.wallMaterial,
			materialMask: wallState.materialMask
				? JSON.parse(JSON.stringify(wallState.materialMask))
				: null,
			floorplanBoundary: floorplanState.floorplanBoundary
				? JSON.parse(JSON.stringify(floorplanState.floorplanBoundary))
				: null,
			calibration: floorplanState.calibration
				? JSON.parse(JSON.stringify(floorplanState.calibration))
				: null
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		persistenceState.lastSaved = new Date();
	} catch {
		// localStorage might be full or unavailable
	}

	// Persist floorplan image as data URL (separate key to avoid main save bloat)
	try {
		if (floorplanState.floorplanUrl && floorplanState.floorplanUrl.startsWith('blob:')) {
			const canvas = document.createElement('canvas');
			const img = new Image();
			img.onload = () => {
				canvas.width = img.naturalWidth;
				canvas.height = img.naturalHeight;
				const ctx = canvas.getContext('2d')!;
				ctx.drawImage(img, 0, 0);
				try {
					const dataUrl = canvas.toDataURL('image/png');
					localStorage.setItem(FLOORPLAN_KEY, dataUrl);
				} catch {
					// Image too large for localStorage
				}
			};
			img.src = floorplanState.floorplanUrl;
		}
	} catch {
		// Ignore floorplan save errors
	}
}

export function restoreFromStorage(): boolean {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return false;

		const data: SavedState = JSON.parse(raw);
		if (!data.version || data.version < 2) {
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(FLOORPLAN_KEY);
			return false;
		}
		if (!Array.isArray(data.aps)) return false;

		// Write directly to atoms (not through compat layer)
		projectMeta.name = data.name || 'Untitled Project';
		projectMeta.ispSpeed = data.ispSpeed ?? 0;
		projectMeta.targetThroughput = data.targetThroughput ?? 50;

		apState.band = data.band || '5ghz';
		apState.channelWidth = data.channelWidth || 20;
		apState.regulatoryDomain = data.regulatoryDomain || 'fcc';
		apState.aps = data.aps;

		floorplanState.unitSystem = data.unitSystem ?? 'imperial';
		floorplanState.floorplanScale = data.floorplanScale ?? 0.4;
		floorplanState.floorplanBoundary = data.floorplanBoundary ?? null;
		floorplanState.calibration = data.calibration ?? null;

		wallState.wallMask = data.wallMask ?? null;
		wallState.wallAttenuation = data.wallAttenuation ?? 5;
		wallState.wallMaterial = (data.wallMaterial ?? 0) as WallMaterialId;
		wallState.materialMask = data.materialMask ?? null;

		// Restore floorplan image
		const floorplanData = localStorage.getItem(FLOORPLAN_KEY);
		if (floorplanData) {
			floorplanState.floorplanUrl = floorplanData;
		}

		clearHistory();
		return true;
	} catch {
		return false;
	}
}

export function clearSavedState(): void {
	localStorage.removeItem(STORAGE_KEY);
	localStorage.removeItem(FLOORPLAN_KEY);
	persistenceState.lastSaved = null;
}

export function scheduleSave(): void {
	if (saveTimeout) clearTimeout(saveTimeout);
	saveTimeout = setTimeout(saveToStorage, SAVE_DELAY);
}

export function hasSavedState(): boolean {
	return localStorage.getItem(STORAGE_KEY) !== null;
}
