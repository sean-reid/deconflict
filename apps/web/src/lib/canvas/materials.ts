/**
 * Wall material definitions for RF attenuation modeling.
 * Values based on IEEE 802.11 propagation studies and ITU-R P.1238.
 */

export type WallMaterialId = 0 | 1 | 2 | 3 | 4 | 5;

export interface WallMaterial {
	id: WallMaterialId;
	name: string;
	attenuation: number; // dB per wall crossing at 5 GHz
	color: [number, number, number]; // RGB for wall overlay
}

export const WALL_MATERIALS: readonly WallMaterial[] = [
	{ id: 0, name: 'Drywall', attenuation: 3, color: [200, 200, 210] },
	{ id: 1, name: 'Wood', attenuation: 5, color: [160, 130, 90] },
	{ id: 2, name: 'Glass', attenuation: 2, color: [140, 210, 230] },
	{ id: 3, name: 'Brick', attenuation: 8, color: [180, 80, 60] },
	{ id: 4, name: 'Concrete', attenuation: 12, color: [130, 130, 140] },
	{ id: 5, name: 'Metal', attenuation: 20, color: [90, 100, 120] }
] as const;

export const DEFAULT_MATERIAL: WallMaterialId = 0; // Drywall

export function getMaterial(id: WallMaterialId): WallMaterial {
	return WALL_MATERIALS[id] ?? WALL_MATERIALS[0]!;
}

export function getMaterialByName(name: string): WallMaterial | undefined {
	return WALL_MATERIALS.find((m) => m.name.toLowerCase() === name.toLowerCase());
}
