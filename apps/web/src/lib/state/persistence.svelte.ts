import { projectState } from './project.svelte.js';
import { clearHistory } from './history.svelte.js';
import type { AccessPoint } from './project.svelte.js';
import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';

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
	floorplanBoundary?: Array<{ x: number; y: number }> | null;
	calibration: typeof projectState.calibration;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
export const persistenceState = $state({ lastSaved: null as Date | null });

function saveToStorage(): void {
	try {
		const data: SavedState = {
			version: 2,
			name: projectState.name,
			band: projectState.band,
			channelWidth: projectState.channelWidth,
			regulatoryDomain: projectState.regulatoryDomain,
			aps: JSON.parse(JSON.stringify(projectState.aps)),
			unitSystem: projectState.unitSystem,
			floorplanScale: projectState.floorplanScale,
			ispSpeed: projectState.ispSpeed,
			targetThroughput: projectState.targetThroughput,
			wallMask: projectState.wallMask ? JSON.parse(JSON.stringify(projectState.wallMask)) : null,
			wallAttenuation: projectState.wallAttenuation,
			floorplanBoundary: projectState.floorplanBoundary
				? JSON.parse(JSON.stringify(projectState.floorplanBoundary))
				: null,
			calibration: projectState.calibration
				? JSON.parse(JSON.stringify(projectState.calibration))
				: null
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		persistenceState.lastSaved = new Date();
	} catch {
		// localStorage might be full or unavailable
	}

	// Persist floorplan image as data URL (separate key to avoid main save bloat)
	try {
		if (projectState.floorplanUrl && projectState.floorplanUrl.startsWith('blob:')) {
			// Convert blob URL to data URL for persistence
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
			img.src = projectState.floorplanUrl;
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
			// Clear stale v1 data with potentially wrong wall coordinates
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(FLOORPLAN_KEY);
			return false;
		}
		if (!Array.isArray(data.aps)) return false;

		projectState.name = data.name || 'Untitled Project';
		projectState.band = data.band || '5ghz';
		projectState.channelWidth = data.channelWidth || 20;
		projectState.regulatoryDomain = data.regulatoryDomain || 'fcc';
		projectState.aps = data.aps;
		projectState.unitSystem = data.unitSystem ?? 'imperial';
		projectState.floorplanScale = data.floorplanScale ?? 0.4;
		projectState.ispSpeed = data.ispSpeed ?? 0;
		projectState.targetThroughput = data.targetThroughput ?? 50;
		projectState.wallMask = data.wallMask ?? null;
		projectState.wallAttenuation = data.wallAttenuation ?? 5;
		projectState.floorplanBoundary = data.floorplanBoundary ?? null;
		projectState.calibration = data.calibration ?? null;

		// Restore floorplan image
		const floorplanData = localStorage.getItem(FLOORPLAN_KEY);
		if (floorplanData) {
			projectState.floorplanUrl = floorplanData;
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
