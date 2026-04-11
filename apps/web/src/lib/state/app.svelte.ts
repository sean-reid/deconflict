export type SidebarPanel = 'aps' | 'solver' | 'export';

export const appState = $state({
	sidebarPanel: 'aps' as SidebarPanel,
	sidebarOpen: true,
	showGrid: true,
	showRangeRings: true,
	showConflictEdges: true,
	showLabels: true
});
