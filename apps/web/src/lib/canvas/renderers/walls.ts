import type { Layer, RenderContext } from '../types.js';
import type { DecodedWallMask } from '../wall-detect.js';
import { WALL_MATERIALS, type WallMaterialId } from '../materials.js';

export class WallLayer implements Layer {
	id = 'walls';
	visible = true;
	mask: DecodedWallMask | null = null;
	materialMap: Uint8Array | null = null;
	defaultMaterial: WallMaterialId = 0;

	private cachedImage: HTMLCanvasElement | null = null;
	private cachedMaskRef: Uint8Array | null = null;
	private cachedMatRef: Uint8Array | null = null;
	private cachedDefaultMat: WallMaterialId = -1 as WallMaterialId; // force first render

	/** Force the colorized image to regenerate on next render */
	invalidateCache(): void {
		this.cachedMaskRef = null;
	}

	render(rc: RenderContext): void {
		if (!this.mask) return;
		// Skip rendering empty masks (e.g. draw-from-scratch before any walls are drawn)
		if (!this.cachedImage && !this.mask.data.some((v) => v)) return;
		const { camera, width, height } = rc;

		const needsRegen =
			this.mask.data !== this.cachedMaskRef ||
			this.materialMap !== this.cachedMatRef ||
			this.defaultMaterial !== this.cachedDefaultMat;

		if (needsRegen) {
			this.cachedImage = colorize(this.mask, this.materialMap, this.defaultMaterial);
			this.cachedMaskRef = this.mask.data;
			this.cachedMatRef = this.materialMap;
			this.cachedDefaultMat = this.defaultMaterial;
		}

		const transform = camera.getTransform();
		const offscreen = document.createElement('canvas');
		offscreen.width = width;
		offscreen.height = height;
		const oc = offscreen.getContext('2d')!;
		const [a, b, c, d, e, f] = transform;
		oc.setTransform(a, b, c, d, e, f);
		oc.drawImage(this.cachedImage!, 0, 0);

		rc.compositeOffscreen(offscreen, 0.4);
	}
}

function colorize(
	mask: DecodedWallMask,
	materialMap: Uint8Array | null,
	defaultMaterial: WallMaterialId
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = mask.width;
	canvas.height = mask.height;
	const ctx = canvas.getContext('2d')!;
	const imgData = ctx.createImageData(mask.width, mask.height);
	const defaultColor = WALL_MATERIALS[defaultMaterial]?.color ?? WALL_MATERIALS[0]!.color;

	for (let i = 0; i < mask.data.length; i++) {
		if (mask.data[i]) {
			const j = i * 4;
			const matId = materialMap ? materialMap[i]! : defaultMaterial;
			const color = WALL_MATERIALS[matId]?.color ?? defaultColor;
			imgData.data[j] = color[0];
			imgData.data[j + 1] = color[1];
			imgData.data[j + 2] = color[2];
			imgData.data[j + 3] = 255;
		}
	}
	ctx.putImageData(imgData, 0, 0);
	return canvas;
}
