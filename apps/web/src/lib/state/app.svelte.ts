export type SidebarPanel = 'floorplan' | 'aps';

export const appState = $state({
	sidebarPanel: 'floorplan' as SidebarPanel,
	sidebarOpen: true,
	showGrid: true,
	showLabels: true,
	showHeatmap: false,
	showFloorplan: true,
	showAPs: true,
	showWalls: true
});
