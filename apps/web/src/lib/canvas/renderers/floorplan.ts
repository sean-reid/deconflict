import type { Layer, RenderContext } from '../types.js';

// Target floorplan width in world units (pixels at 1x zoom)
const TARGET_WIDTH = 800;

export class FloorplanLayer implements Layer {
	id = 'floorplan';
	visible = true;
	private image: HTMLImageElement | null = null;
	private imageReady = false;
	private onReady: (() => void) | null = null;
	private drawWidth = 0;
	private drawHeight = 0;
	opacity = 0.8;

	get imageWidth(): number {
		return this.drawWidth;
	}
	get imageHeight(): number {
		return this.drawHeight;
	}
	/** The scale factor from original image pixels to world units */
	get scaleFactor(): number {
		const natW = this.image?.naturalWidth || this.image?.width || 1;
		return this.drawWidth > 0 ? this.drawWidth / natW : 1;
	}

	loadImage(url: string, onReady?: () => void): void {
		// Skip reload if already showing this URL (avoids revoking blob URLs)
		if (this.image && this.imageReady && this.image.src === url) {
			if (onReady) onReady();
			return;
		}
		this.clearImage();
		this.onReady = onReady ?? null;
		this.image = new Image();
		this.image.onload = () => {
			this.imageReady = true;
			// Scale to a reasonable world size
			const natW = this.image!.naturalWidth || this.image!.width;
			const natH = this.image!.naturalHeight || this.image!.height;
			if (natW > 0 && natH > 0) {
				const s = TARGET_WIDTH / natW;
				this.drawWidth = natW * s;
				this.drawHeight = natH * s;
			} else {
				this.drawWidth = TARGET_WIDTH;
				this.drawHeight = TARGET_WIDTH;
			}
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
		this.drawWidth = 0;
		this.drawHeight = 0;
	}

	render(rc: RenderContext): void {
		if (!this.image || !this.imageReady) return;
		const { ctx, camera } = rc;
		const transform = camera.getTransform();
		const [a, b, c, d, e, f] = transform;
		ctx.transform(a, b, c, d, e, f);
		ctx.globalAlpha = this.opacity;
		ctx.drawImage(this.image, 0, 0, this.drawWidth, this.drawHeight);
		ctx.globalAlpha = 1;
	}
}
