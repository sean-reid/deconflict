export type SidebarPanel = 'aps' | 'solver' | 'compare' | 'export';

export const appState = $state({
	sidebarPanel: 'aps' as SidebarPanel,
	sidebarOpen: true,
	showGrid: true,
	showRangeRings: true,
	showConflictEdges: true,
	showLabels: true
});
