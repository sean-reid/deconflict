import type { WallMaterialId } from '$canvas/materials.js';

export interface WallMaskData {
	dataUrl: string;
	width: number;
	height: number;
	originX: number;
	originY: number;
}

export const wallState = $state({
	wallMask: null as WallMaskData | null,
	wallAttenuation: 5 as number,
	wallMaterial: 0 as WallMaterialId,
	materialMask: null as WallMaskData | null
});
