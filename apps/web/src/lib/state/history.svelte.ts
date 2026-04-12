import { projectState } from './project.svelte.js';
import type { AccessPoint } from './project.svelte.js';
import type { WallMaterialId } from '$canvas/materials.js';
import { notifyMaterialChange } from '$canvas/engine-ref.js';

const MAX_HISTORY = 50;

interface Snapshot {
	aps: AccessPoint[];
	wallMask: { dataUrl: string; width: number; height: number } | null;
	materialMask: { dataUrl: string; width: number; height: number } | null;
	wallMaterial: WallMaterialId;
}

let undoStack: Snapshot[] = $state([]);
let redoStack: Snapshot[] = $state([]);

function takeSnapshot(): Snapshot {
	return {
		aps: JSON.parse(JSON.stringify(projectState.aps)),
		wallMask: projectState.wallMask ? { ...projectState.wallMask } : null,
		materialMask: projectState.materialMask ? { ...projectState.materialMask } : null,
		wallMaterial: projectState.wallMaterial
	};
}

function applySnapshot(snap: Snapshot): void {
	projectState.aps = snap.aps;
	projectState.wallMask = snap.wallMask;
	projectState.materialMask = snap.materialMask;
	projectState.wallMaterial = snap.wallMaterial;
	notifyMaterialChange(snap.wallMaterial);
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
