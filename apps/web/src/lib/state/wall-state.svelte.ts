import type { WallMaterialId } from '$canvas/materials.js';

export const wallState = $state({
	wallMask: null as { dataUrl: string; width: number; height: number } | null,
	wallAttenuation: 5 as number,
	wallMaterial: 0 as WallMaterialId,
	materialMask: null as { dataUrl: string; width: number; height: number } | null
});
