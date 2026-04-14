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
	attenuation: Record<Band, number>; // dB per floor crossing
}

export type FloorMaterialId = 0 | 1 | 2 | 3;

export const FLOOR_MATERIALS: readonly FloorMaterial[] = [
	{
		id: 0,
		name: 'Wood Frame',
		attenuation: { '2.4ghz': 8, '5ghz': 12, '6ghz': 15 }
	},
	{
		id: 1,
		name: 'Concrete Slab',
		attenuation: { '2.4ghz': 15, '5ghz': 20, '6ghz': 24 }
	},
	{
		id: 2,
		name: 'Reinforced Concrete',
		attenuation: { '2.4ghz': 20, '5ghz': 28, '6ghz': 32 }
	},
	{
		id: 3,
		name: 'Steel Deck',
		attenuation: { '2.4ghz': 25, '5ghz': 35, '6ghz': 40 }
	}
];

/** Get floor attenuation in dB for a material and band. */
export function getFloorAttenuation(materialId: FloorMaterialId, band: Band): number {
	return FLOOR_MATERIALS[materialId]?.attenuation[band] ?? 20;
}
