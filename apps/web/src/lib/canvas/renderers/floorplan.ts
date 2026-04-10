import type { Layer, RenderContext } from '../types.js';

export class FloorplanLayer implements Layer {
	id = 'floorplan';
	visible = true;
	private image: HTMLImageElement | null = null;
	private imageReady = false;
	private onReady: (() => void) | null = null;
	opacity = 0.8;

	loadImage(url: string, onReady?: () => void): void {
		this.clearImage();
		this.onReady = onReady ?? null;
		this.image = new Image();
		this.image.onload = () => {
			this.imageReady = true;
			if (this.onReady) this.onReady();
		};
		this.image.src = url;
	}

	clearImage(): void {
		if (this.image?.src.startsWith('blob:')) {
			URL.revokeObjectURL(this.image.src);
		}
		this.image = null;
		this.imageReady = false;
		this.onReady = null;
	}

	render(rc: RenderContext): void {
		if (!this.image || !this.imageReady) return;
		const { ctx, camera } = rc;
		const transform = camera.getTransform();
		const [a, b, c, d, e, f] = transform;
		ctx.transform(a, b, c, d, e, f);
		ctx.globalAlpha = this.opacity;
		ctx.drawImage(this.image, 0, 0);
		ctx.globalAlpha = 1;
	}
}
