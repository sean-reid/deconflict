import { apState } from './ap-state.svelte.js';
import { wallState } from './wall-state.svelte.js';
import { floorState } from './floor-state.svelte.js';
import { floorplanState } from './floorplan-state.svelte.js';
import type { AccessPoint } from './ap-state.svelte.js';
import type { Floor } from './floor-state.svelte.js';
import type { WallMaterialId } from '$canvas/materials.js';

const MAX_HISTORY = 50;

interface Snapshot {
	aps: AccessPoint[];
	wallMask: {
		dataUrl: string;
		width: number;
		height: number;
		originX: number;
		originY: number;
	} | null;
	materialMask: {
		dataUrl: string;
		width: number;
		height: number;
		originX: number;
		originY: number;
	} | null;
	roomTypeMask: {
		dataUrl: string;
		width: number;
		height: number;
		originX: number;
		originY: number;
	} | null;
	wallMaterial: WallMaterialId;
	floors: Floor[];
	currentFloorId: string;
}

let undoStack: Snapshot[] = $state([]);
let redoStack: Snapshot[] = $state([]);

function takeSnapshot(): Snapshot {
	return {
		aps: JSON.parse(JSON.stringify(apState.aps)),
		wallMask: wallState.wallMask ? { ...wallState.wallMask } : null,
		materialMask: wallState.materialMask ? { ...wallState.materialMask } : null,
		roomTypeMask: wallState.roomTypeMask ? { ...wallState.roomTypeMask } : null,
		wallMaterial: wallState.wallMaterial,
		floors: JSON.parse(JSON.stringify(floorState.floors)),
		currentFloorId: floorState.currentFloorId
	};
}

function applySnapshot(snap: Snapshot): void {
	apState.aps = snap.aps;
	floorState.floors = snap.floors;
	floorState.currentFloorId = snap.currentFloorId;
	// Sync current floor's wall data to legacy atoms
	const cur = snap.floors.find((f) => f.id === snap.currentFloorId) ?? snap.floors[0];
	if (cur) {
		wallState.wallMask = cur.wallMask;
		wallState.materialMask = cur.materialMask;
		wallState.roomTypeMask = cur.roomTypeMask;
		wallState.wallMaterial = cur.wallMaterial;
		wallState.wallAttenuation = cur.wallAttenuation;
		floorplanState.floorplanUrl = cur.floorplanUrl;
		floorplanState.floorplanScale = cur.floorplanScale;
		floorplanState.calibration = cur.calibration;
		floorplanState.floorplanBoundary = cur.floorplanBoundary;
	} else {
		wallState.wallMask = snap.wallMask;
		wallState.materialMask = snap.materialMask;
		wallState.roomTypeMask = snap.roomTypeMask;
		wallState.wallMaterial = snap.wallMaterial;
	}
}

export function pushState(): void {
	undoStack.push(takeSnapshot());
	if (undoStack.length > MAX_HISTORY) {
		undoStack.shift();
	}
	redoStack.length = 0;
}

export function undo(): void {
	if (undoStack.length === 0) return;
	redoStack.push(takeSnapshot());
	applySnapshot(undoStack.pop()!);
}

export function redo(): void {
	if (redoStack.length === 0) return;
	undoStack.push(takeSnapshot());
	applySnapshot(redoStack.pop()!);
}

export function canUndo(): boolean {
	return undoStack.length > 0;
}

export function canRedo(): boolean {
	return redoStack.length > 0;
}

export function clearHistory(): void {
	undoStack.length = 0;
	redoStack.length = 0;
}
