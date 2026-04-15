/**
 * Connected component labeling and region operations.
 * Used for wall blob detection (click-to-override material) and room detection.
 */

export interface RegionLabels {
	labels: Int32Array; // pixel → region ID (-1 = not in any region)
	regionCount: number;
}

/**
 * Label connected regions in a binary mask via BFS.
 * Works on any Uint8Array where truthy pixels are the regions to label.
 * Used for wall blobs (mask = wallData) and rooms (mask = interior).
 */
export function labelConnectedRegions(mask: Uint8Array, w: number, h: number): RegionLabels {
	const labels = new Int32Array(w * h).fill(-1);
	let nextLabel = 0;

	for (let i = 0; i < w * h; i++) {
		if (!mask[i] || labels[i] !== -1) continue;

		const label = nextLabel++;
		const queue = [i];
		labels[i] = label;

		while (queue.length > 0) {
			const idx = queue.pop()!;
			const x = idx % w;
			const y = Math.floor(idx / w);

			if (y > 0 && mask[idx - w] && labels[idx - w] === -1) {
				labels[idx - w] = label;
				queue.push(idx - w);
			}
			if (y < h - 1 && mask[idx + w] && labels[idx + w] === -1) {
				labels[idx + w] = label;
				queue.push(idx + w);
			}
			if (x > 0 && mask[idx - 1] && labels[idx - 1] === -1) {
				labels[idx - 1] = label;
				queue.push(idx - 1);
			}
			if (x < w - 1 && mask[idx + 1] && labels[idx + 1] === -1) {
				labels[idx + 1] = label;
				queue.push(idx + 1);
			}
		}
	}

	return { labels, regionCount: nextLabel };
}

/** Backward-compatible alias. */
export const labelWallBlobs = labelConnectedRegions;
/** Backward-compatible type alias. */
export type WallLabels = RegionLabels;

/**
 * Fill all pixels of a given region with a value in a target mask.
 * Used for wall material overrides and room type assignments.
 */
export function fillRegion(
	labels: Int32Array,
	targetMask: Uint8Array,
	regionId: number,
	value: number
): void {
	for (let i = 0; i < labels.length; i++) {
		if (labels[i] === regionId) {
			targetMask[i] = value;
		}
	}
}

/** Backward-compatible alias. */
export const relabelBlob = fillRegion;

/** Encode a Uint8Array mask as a PNG data URL (R channel stores the value). */
export function encodeMaterialMask(mask: Uint8Array, w: number, h: number): string {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	const imgData = ctx.createImageData(w, h);
	for (let i = 0; i < mask.length; i++) {
		const j = i * 4;
		imgData.data[j] = mask[i]!;
		imgData.data[j + 1] = 0;
		imgData.data[j + 2] = 0;
		imgData.data[j + 3] = 255;
	}
	ctx.putImageData(imgData, 0, 0);
	return canvas.toDataURL('image/png');
}

/** Decode a PNG data URL to a Uint8Array mask (reads R channel). */
export function decodeMaterialMask(dataUrl: string, w: number, h: number): Promise<Uint8Array> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext('2d')!;
			ctx.drawImage(img, 0, 0);
			const data = ctx.getImageData(0, 0, w, h).data;
			const mask = new Uint8Array(w * h);
			for (let i = 0; i < mask.length; i++) {
				mask[i] = data[i * 4]!;
			}
			resolve(mask);
		};
		img.onerror = () => resolve(new Uint8Array(w * h));
		img.src = dataUrl;
	});
}
