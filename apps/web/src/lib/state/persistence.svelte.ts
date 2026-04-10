import { projectState } from './project.svelte.js';
import { clearHistory } from './history.svelte.js';
import type { AccessPoint } from './project.svelte.js';
import type { Band, ChannelWidth, RegulatoryDomain } from '@deconflict/channels';

const STORAGE_KEY = 'deconflict:project';
const SAVE_DELAY = 2000;

interface SavedState {
	version: 1;
	name: string;
	band: Band;
	channelWidth: ChannelWidth;
	regulatoryDomain: RegulatoryDomain;
	aps: AccessPoint[];
	floorplanScale: number;
	// Note: floorplanUrl (blob URL) cannot be persisted - it is session-only
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;
export const persistenceState = $state({ lastSaved: null as Date | null });

function saveToStorage(): void {
	try {
		const data: SavedState = {
			version: 1,
			name: projectState.name,
			band: projectState.band,
			channelWidth: projectState.channelWidth,
			regulatoryDomain: projectState.regulatoryDomain,
			aps: JSON.parse(JSON.stringify(projectState.aps)),
			floorplanScale: projectState.floorplanScale
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		persistenceState.lastSaved = new Date();
	} catch {
		// localStorage might be full or unavailable
	}
}

export function restoreFromStorage(): boolean {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return false;

		const data: SavedState = JSON.parse(raw);
		if (!data.version || data.version !== 1) return false;
		if (!Array.isArray(data.aps)) return false;

		projectState.name = data.name || 'Untitled Project';
		projectState.band = data.band || '5ghz';
		projectState.channelWidth = data.channelWidth || 20;
		projectState.regulatoryDomain = data.regulatoryDomain || 'fcc';
		projectState.aps = data.aps;
		projectState.floorplanScale = data.floorplanScale ?? 1;
		// floorplanUrl is not restored (blob URLs don't persist)

		clearHistory();
		return true;
	} catch {
		return false;
	}
}

export function clearSavedState(): void {
	localStorage.removeItem(STORAGE_KEY);
	persistenceState.lastSaved = null;
}

export function scheduleSave(): void {
	if (saveTimeout) clearTimeout(saveTimeout);
	saveTimeout = setTimeout(saveToStorage, SAVE_DELAY);
}

export function hasSavedState(): boolean {
	return localStorage.getItem(STORAGE_KEY) !== null;
}
