/**
 * Floor/ceiling material definitions with per-band RF attenuation.
 *
 * Sources:
 *   - ITU-R P.1238-10 (2019): Indoor propagation model
 *   - COST 231 Multi-Wall Multi-Floor Model
 *   - iBwave material database: https://blog.ibwave.com/a-closer-look-at-attenuation-across-materials-the-2-4ghz-5ghz-bands/
 */

import type { Band } from '@deconflict/channels';

export interface FloorMaterial {
	id: number;
	name: string;
	dbPerMeter: Record<Band, number>; // dB per meter of material thickness
	typicalThickness: number; // meters (default slab thickness)
}

export type FloorMaterialId = 0 | 1 | 2 | 3;

/**
 * Slab material definitions with per-meter attenuation.
 * Total loss = dbPerMeter * thickness.
 *
 * Sources: ITU-R P.1238, iBwave material database, NIST measurements.
 */
export const FLOOR_MATERIALS: readonly FloorMaterial[] = [
	{
		id: 0,
		name: 'Wood Frame',
		dbPerMeter: { '2.4ghz': 40, '5ghz': 60, '6ghz': 75 },
		typicalThickness: 0.2 // ~8" joist + subfloor
	},
	{
		id: 1,
		name: 'Concrete Slab',
		dbPerMeter: { '2.4ghz': 75, '5ghz': 100, '6ghz': 120 },
		typicalThickness: 0.2 // ~8" slab
	},
	{
		id: 2,
		name: 'Reinforced Concrete',
		dbPerMeter: { '2.4ghz': 100, '5ghz': 140, '6ghz': 160 },
		typicalThickness: 0.2
	},
	{
		id: 3,
		name: 'Steel Deck',
		dbPerMeter: { '2.4ghz': 125, '5ghz': 175, '6ghz': 200 },
		typicalThickness: 0.2
	}
];

/**
 * Get floor attenuation in dB for a material, band, and thickness.
 * If thickness is 0 or not provided, uses the material's typical thickness.
 */
export function getFloorAttenuation(
	materialId: FloorMaterialId,
	band: Band,
	thickness?: number
): number {
	const mat = FLOOR_MATERIALS[materialId];
	if (!mat) return 20;
	const t = thickness && thickness > 0 ? thickness : mat.typicalThickness;
	return mat.dbPerMeter[band] * t;
}
