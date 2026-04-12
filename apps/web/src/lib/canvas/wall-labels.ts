/**
 * Connected component labeling for wall blobs.
 * Used to identify which wall blob a clicked pixel belongs to,
 * so an entire wall segment can be relabeled with a new material.
 */

export interface WallLabels {
	labels: Int32Array; // pixel -> blob ID (-1 = not wall)
	blobCount: number;
}

/** Label connected components of wall pixels via BFS. */
export function labelWallBlobs(wallData: Uint8Array, w: number, h: number): WallLabels {
	const labels = new Int32Array(w * h).fill(-1);
	let nextLabel = 0;

	for (let i = 0; i < w * h; i++) {
		if (!wallData[i] || labels[i] !== -1) continue;

		const label = nextLabel++;
		const queue = [i];
		labels[i] = label;

		while (queue.length > 0) {
			const idx = queue.pop()!;
			const x = idx % w;
			const y = Math.floor(idx / w);

			if (y > 0 && wallData[idx - w] && labels[idx - w] === -1) {
				labels[idx - w] = label;
				queue.push(idx - w);
			}
			if (y < h - 1 && wallData[idx + w] && labels[idx + w] === -1) {
				labels[idx + w] = label;
				queue.push(idx + w);
			}
			if (x > 0 && wallData[idx - 1] && labels[idx - 1] === -1) {
				labels[idx - 1] = label;
				queue.push(idx - 1);
			}
			if (x < w - 1 && wallData[idx + 1] && labels[idx + 1] === -1) {
				labels[idx + 1] = label;
				queue.push(idx + 1);
			}
		}
	}

	return { labels, blobCount: nextLabel };
}

/** Set all pixels of a given blob to a new material ID in the material mask. */
export function relabelBlob(
	labels: Int32Array,
	materialMask: Uint8Array,
	blobId: number,
	newMaterialId: number
): void {
	for (let i = 0; i < labels.length; i++) {
		if (labels[i] === blobId) {
			materialMask[i] = newMaterialId;
		}
	}
}

/** Encode a Uint8Array material mask as a PNG data URL. */
export function encodeMaterialMask(materialMask: Uint8Array, w: number, h: number): string {
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d')!;
	const imgData = ctx.createImageData(w, h);
	for (let i = 0; i < materialMask.length; i++) {
		const j = i * 4;
		imgData.data[j] = materialMask[i]!; // material ID in R channel
		imgData.data[j + 1] = 0;
		imgData.data[j + 2] = 0;
		imgData.data[j + 3] = 255;
	}
	ctx.putImageData(imgData, 0, 0);
	return canvas.toDataURL('image/png');
}

/** Decode a material mask PNG data URL to a Uint8Array. */
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
				mask[i] = data[i * 4]!; // material ID from R channel
			}
			resolve(mask);
		};
		img.onerror = () => resolve(new Uint8Array(w * h));
		img.src = dataUrl;
	});
}
