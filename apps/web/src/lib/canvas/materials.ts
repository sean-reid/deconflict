/**
 * Wall material definitions for RF attenuation modeling.
 * Values based on IEEE 802.11 propagation studies and ITU-R P.1238.
 */

export type WallMaterialId = 0 | 1 | 2 | 3 | 4 | 5;

export interface WallMaterial {
	id: WallMaterialId;
	name: string;
	dbPerMeter: number; // dB per meter of material thickness (5 GHz reference)
	typicalThickness: number; // meters — used when calibration unavailable
	attenuation: number; // dB per typical crossing = dbPerMeter * typicalThickness (backward compat)
	color: [number, number, number];
}

/**
 * Wall material definitions with per-meter attenuation.
 * Effective dB = dbPerMeter * thickness (from ray march pixel count when calibrated,
 * or typicalThickness when uncalibrated).
 *
 * Sources: ITU-R P.1238, IEEE 802.11, iBwave material database.
 */
export const WALL_MATERIALS: readonly WallMaterial[] = [
	{
		id: 0,
		name: 'Drywall',
		dbPerMeter: 25,
		typicalThickness: 0.12,
		attenuation: 3,
		color: [200, 200, 210]
	},
	{
		id: 1,
		name: 'Wood',
		dbPerMeter: 33,
		typicalThickness: 0.15,
		attenuation: 5,
		color: [160, 130, 90]
	},
	{
		id: 2,
		name: 'Glass',
		dbPerMeter: 200,
		typicalThickness: 0.01,
		attenuation: 2,
		color: [140, 210, 230]
	},
	{
		id: 3,
		name: 'Brick',
		dbPerMeter: 35,
		typicalThickness: 0.23,
		attenuation: 8,
		color: [180, 80, 60]
	},
	{
		id: 4,
		name: 'Concrete',
		dbPerMeter: 60,
		typicalThickness: 0.2,
		attenuation: 12,
		color: [130, 130, 140]
	},
	{
		id: 5,
		name: 'Metal',
		dbPerMeter: 120,
		typicalThickness: 0.17,
		attenuation: 20,
		color: [90, 100, 120]
	}
] as const;

export const DEFAULT_MATERIAL: WallMaterialId = 0;

export function getMaterial(id: WallMaterialId): WallMaterial {
	return WALL_MATERIALS[id] ?? WALL_MATERIALS[0]!;
}

/** Get flat dB per crossing (dbPerMeter * typicalThickness). Used when calibration unavailable. */
export function getFlatAttenuation(id: WallMaterialId): number {
	const m = WALL_MATERIALS[id];
	return m ? m.dbPerMeter * m.typicalThickness : 3;
}

export function getMaterialByName(name: string): WallMaterial | undefined {
	return WALL_MATERIALS.find((m) => m.name.toLowerCase() === name.toLowerCase());
}
