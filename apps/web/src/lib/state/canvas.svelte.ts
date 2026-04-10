export const canvasState = $state({
	zoom: 1,
	selectedApIds: [] as string[],
	hoveredApId: null as string | null,
	isDragging: false
});

export function selectAp(id: string, addToSelection = false): void {
	if (addToSelection) {
		if (canvasState.selectedApIds.includes(id)) {
			canvasState.selectedApIds = canvasState.selectedApIds.filter((i) => i !== id);
		} else {
			canvasState.selectedApIds = [...canvasState.selectedApIds, id];
		}
	} else {
		canvasState.selectedApIds = [id];
	}
}

export function selectAps(ids: string[]): void {
	canvasState.selectedApIds = ids;
}

export function clearSelection(): void {
	canvasState.selectedApIds = [];
}

export function isSelected(id: string): boolean {
	return canvasState.selectedApIds.includes(id);
}
