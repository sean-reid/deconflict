export const floorplanState = $state({
	floorplanUrl: null as string | null,
	floorplanScale: 0.4,
	calibration: null as { worldUnitsPerMeter: number } | null,
	floorplanBoundary: null as Array<{ x: number; y: number }> | null,
	unitSystem: 'imperial' as 'imperial' | 'metric'
});
