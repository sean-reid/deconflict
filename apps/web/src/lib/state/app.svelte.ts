export type SidebarPanel = 'floorplan' | 'aps';
export type WallEditMode = 'erase' | 'draw' | 'material' | null;

export const appState = $state({
	sidebarPanel: 'floorplan' as SidebarPanel,
	sidebarOpen: true,
	showGrid: true,
	showLabels: true,
	showHeatmap: false,
	showFloorplan: true,
	showAPs: true,
	showWalls: true,
	wallEditMode: null as WallEditMode,
	wallEditLastMode: 'erase' as Exclude<WallEditMode, null>,
	wallBrushSize: 15
});
