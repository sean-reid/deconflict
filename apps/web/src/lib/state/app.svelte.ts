export type SidebarPanel = 'floorplan' | 'aps' | 'results';

export const appState = $state({
	sidebarPanel: 'aps' as SidebarPanel,
	sidebarOpen: true,
	showGrid: true,
	showRangeRings: true,
	showConflictEdges: true,
	showLabels: true,
	showHeatmap: false,
	showFloorplan: true,
	showAPs: true
});
