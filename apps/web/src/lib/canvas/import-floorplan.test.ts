import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$state/persistence.svelte.js', () => ({ scheduleSave: vi.fn() }));

import { floorplanState } from '$state/floorplan-state.svelte.js';
import { apState } from '$state/ap-state.svelte.js';
import type { AccessPoint } from '$state/ap-state.svelte.js';
import { calibrateCurrentFloorForPdfPage } from './import-floorplan.js';

function ap(interferenceRadius: number): AccessPoint {
	return {
		id: 'ap-1',
		name: 'AP 1',
		x: 0,
		y: 0,
		band: '5ghz',
		channelWidth: 20,
		fixedChannel: null,
		assignedChannel: null,
		interferenceRadius,
		power: 20,
		modelId: null,
		modelLabel: null,
		floorId: 'floor-1'
	} as AccessPoint;
}

describe('calibrateCurrentFloorForPdfPage', () => {
	beforeEach(() => {
		floorplanState.calibration = null;
		apState.aps = [];
	});

	it('rescales AP radii proportionally when a scale replaces an earlier calibration', () => {
		floorplanState.calibration = { worldUnitsPerMeter: 10 };
		apState.aps = [ap(100)];

		calibrateCurrentFloorForPdfPage(25);

		expect(floorplanState.calibration).toEqual({ worldUnitsPerMeter: 25 });
		expect(apState.aps[0]!.interferenceRadius).toBe(Math.round((100 * 25) / 10));
	});

	it('turns the uncalibrated default radius into 15 m on a first calibration', () => {
		apState.aps = [ap(150), ap(90)];

		calibrateCurrentFloorForPdfPage(12.5);

		expect(floorplanState.calibration).toEqual({ worldUnitsPerMeter: 12.5 });
		expect(apState.aps[0]!.interferenceRadius).toBe(Math.round(15 * 12.5));
		expect(apState.aps[1]!.interferenceRadius).toBe(90);
	});

	it('clears the calibration and leaves AP radii alone when no scale is given', () => {
		floorplanState.calibration = { worldUnitsPerMeter: 10 };
		apState.aps = [ap(100)];

		calibrateCurrentFloorForPdfPage(null);

		expect(floorplanState.calibration).toBeNull();
		expect(apState.aps[0]!.interferenceRadius).toBe(100);
	});
});
