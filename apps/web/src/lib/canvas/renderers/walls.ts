import type { Layer, RenderContext } from '../types.js';
import type { DecodedWallMask } from '../wall-detect.js';

const WALL_COLOR = [200, 200, 210]; // drywall gray

export class WallLayer implements Layer {
	id = 'walls';
	visible = true;
	mask: DecodedWallMask | null = null;

	private cachedImage: HTMLCanvasElement | null = null;
	private cachedMaskRef: Uint8Array | null = null;

	render(rc: RenderContext): void {
		if (!this.mask) return;
		const { camera, width, height } = rc;

		// Cache the colorized mask image (only regenerate when mask data changes)
		if (this.mask.data !== this.cachedMaskRef) {
			this.cachedImage = colorize(this.mask);
			this.cachedMaskRef = this.mask.data;
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

function colorize(mask: DecodedWallMask): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = mask.width;
	canvas.height = mask.height;
	const ctx = canvas.getContext('2d')!;
	const imgData = ctx.createImageData(mask.width, mask.height);
	for (let i = 0; i < mask.data.length; i++) {
		if (mask.data[i]) {
			const j = i * 4;
			imgData.data[j] = WALL_COLOR[0]!;
			imgData.data[j + 1] = WALL_COLOR[1]!;
			imgData.data[j + 2] = WALL_COLOR[2]!;
			imgData.data[j + 3] = 255;
		}
	}
	ctx.putImageData(imgData, 0, 0);
	return canvas;
}
