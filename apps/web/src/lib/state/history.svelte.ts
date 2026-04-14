import { apState } from './ap-state.svelte.js';
import { wallState } from './wall-state.svelte.js';
import type { AccessPoint } from './ap-state.svelte.js';
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
	wallMaterial: WallMaterialId;
}

let undoStack: Snapshot[] = $state([]);
let redoStack: Snapshot[] = $state([]);

function takeSnapshot(): Snapshot {
	return {
		aps: JSON.parse(JSON.stringify(apState.aps)),
		wallMask: wallState.wallMask ? { ...wallState.wallMask } : null,
		materialMask: wallState.materialMask ? { ...wallState.materialMask } : null,
		wallMaterial: wallState.wallMaterial
	};
}

function applySnapshot(snap: Snapshot): void {
	apState.aps = snap.aps;
	wallState.wallMask = snap.wallMask;
	wallState.materialMask = snap.materialMask;
	// Setting wallMaterial triggers the $effect in CanvasView that syncs renderers
	wallState.wallMaterial = snap.wallMaterial;
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
