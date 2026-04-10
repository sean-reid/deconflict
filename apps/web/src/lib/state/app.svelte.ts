export type SidebarPanel = 'aps' | 'solver' | 'compare' | 'export';
export type Tool = 'select' | 'place' | 'pan';

export const appState = $state({
	activeTool: 'select' as Tool,
	sidebarPanel: 'aps' as SidebarPanel,
	sidebarOpen: true,
	showGrid: true,
	showRangeRings: true,
	showConflictEdges: true,
	showLabels: true
});
