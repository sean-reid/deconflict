import { projectState } from './project.svelte.js';
import type { AccessPoint } from './project.svelte.js';

const MAX_HISTORY = 50;

let undoStack: AccessPoint[][] = $state([]);
let redoStack: AccessPoint[][] = $state([]);

function cloneAps(aps: AccessPoint[]): AccessPoint[] {
	return JSON.parse(JSON.stringify(aps));
}

export function pushState(): void {
	undoStack.push(cloneAps(projectState.aps));
	if (undoStack.length > MAX_HISTORY) {
		undoStack.shift();
	}
	// Clear redo stack on new action
	redoStack.length = 0;
}

export function undo(): void {
	if (undoStack.length === 0) return;
	redoStack.push(cloneAps(projectState.aps));
	const prev = undoStack.pop()!;
	projectState.aps = prev;
}

export function redo(): void {
	if (redoStack.length === 0) return;
	undoStack.push(cloneAps(projectState.aps));
	const next = redoStack.pop()!;
	projectState.aps = next;
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
