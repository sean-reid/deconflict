import type { Layer, RenderContext } from '../types.js';
import type { RegionLabels } from '../region-labels.js';
import { ROOM_TYPES, type RoomType } from '../room-types.js';

interface RoomLabelInfo {
	cx: number; // centroid X in mask-local coords
	cy: number; // centroid Y in mask-local coords
	typeId: number;
	type: RoomType;
	regionId: number;
}

export class RoomLabelsLayer implements Layer {
	id = 'room-labels';
	visible = true;

	/** Room type mask: pixel → room type ID (0 = unassigned). */
	roomTypeData: Uint8Array | null = null;
	/** Region labels from labelRooms (interior connected components). */
	roomLabels: RegionLabels | null = null;
	/** Mask dimensions and world origin. */
	maskWidth = 0;
	maskHeight = 0;
	originX = 0;
	originY = 0;
	/** Per-region density overrides: "regionId" → density. */
	densityOverrides: Record<string, number> = {};
	/** Per-region custom labels: "regionId" → label string. */
	customLabels: Record<string, string> = {};

	// Cache
	private cachedTint: HTMLCanvasElement | null = null;
	private cachedLabels: RoomLabelInfo[] = [];
	private cachedTypeRef: Uint8Array | null = null;
	private cachedLabelRef: RegionLabels | null = null;
	private cachedDensityRef: Record<string, number> = {};
	private cachedCustomLabelsRef: Record<string, string> = {};

	invalidateCache(): void {
		this.cachedTypeRef = null;
	}

	render(rc: RenderContext): void {
		if (!this.roomTypeData || !this.roomLabels || this.maskWidth === 0) return;

		const needsRegen =
			this.roomTypeData !== this.cachedTypeRef ||
			this.roomLabels !== this.cachedLabelRef ||
			this.densityOverrides !== this.cachedDensityRef ||
			this.customLabels !== this.cachedCustomLabelsRef;

		if (needsRegen) {
			this.cachedTint = this.buildTintCanvas();
			this.cachedLabels = this.computeLabelPositions();
			this.cachedTypeRef = this.roomTypeData;
			this.cachedLabelRef = this.roomLabels;
			this.cachedDensityRef = this.densityOverrides;
			this.cachedCustomLabelsRef = this.customLabels;
		}

		const { ctx, camera, dpr } = rc;
		const transform = camera.getTransform();
		const [a, b, c, d, e, f] = transform;

		// Draw room tint fills
		if (this.cachedTint) {
			ctx.save();
			ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
			ctx.globalAlpha = 0.18;
			ctx.drawImage(this.cachedTint, this.originX, this.originY);
			ctx.restore();
		}

		// Draw label pills
		if (this.cachedLabels.length === 0) return;

		ctx.save();
		ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
		const zoom = camera.state.zoom;
		const scale = 1 / zoom;
		const fontSize = 10 * scale;
		const padX = 4 * scale;
		const padY = 2 * scale;
		const radius = 3 * scale;

		ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		for (const info of this.cachedLabels) {
			const wx = this.originX + info.cx;
			const wy = this.originY + info.cy;
			const custom = this.customLabels[String(info.regionId)];
			const text = custom || info.type.shortName;
			const metrics = ctx.measureText(text);
			const tw = metrics.width;
			const th = fontSize;
			const bw = tw + padX * 2;
			const bh = th + padY * 2;
			const bx = wx - bw / 2;
			const by = wy - bh / 2;

			// Pill background
			const [r, g, b2] = info.type.color;
			ctx.fillStyle = `rgba(${r}, ${g}, ${b2}, 0.85)`;
			ctx.beginPath();
			ctx.roundRect(bx, by, bw, bh, radius);
			ctx.fill();

			// Text
			ctx.fillStyle = '#ffffff';
			ctx.fillText(text, wx, wy);
		}
		ctx.restore();
	}

	private buildTintCanvas(): HTMLCanvasElement {
		const canvas = document.createElement('canvas');
		canvas.width = this.maskWidth;
		canvas.height = this.maskHeight;
		const ctx = canvas.getContext('2d')!;
		const imgData = ctx.createImageData(this.maskWidth, this.maskHeight);
		const data = this.roomTypeData!;
		const typeMap = new Map<number, RoomType>();
		for (const t of ROOM_TYPES) typeMap.set(t.id, t);

		for (let i = 0; i < data.length; i++) {
			const typeId = data[i]!;
			if (typeId === 0) continue;
			const type = typeMap.get(typeId);
			if (!type) continue;
			const j = i * 4;
			imgData.data[j] = type.color[0];
			imgData.data[j + 1] = type.color[1];
			imgData.data[j + 2] = type.color[2];
			imgData.data[j + 3] = 255;
		}
		ctx.putImageData(imgData, 0, 0);
		return canvas;
	}

	private computeLabelPositions(): RoomLabelInfo[] {
		const labels = this.roomLabels!;
		const typeData = this.roomTypeData!;
		const typeMap = new Map<number, RoomType>();
		for (const t of ROOM_TYPES) typeMap.set(t.id, t);

		// Accumulate per-region centroid sums
		const regions = new Map<number, { sumX: number; sumY: number; count: number; typeId: number }>();

		for (let i = 0; i < labels.labels.length; i++) {
			const regionId = labels.labels[i]!;
			if (regionId < 0) continue;
			const typeId = typeData[i]!;
			if (typeId === 0) continue;

			const x = i % this.maskWidth;
			const y = Math.floor(i / this.maskWidth);

			let acc = regions.get(regionId);
			if (!acc) {
				acc = { sumX: 0, sumY: 0, count: 0, typeId };
				regions.set(regionId, acc);
			}
			acc.sumX += x;
			acc.sumY += y;
			acc.count++;
		}

		const result: RoomLabelInfo[] = [];
		for (const [regionId, acc] of regions) {
			const type = typeMap.get(acc.typeId);
			if (!type) continue;
			result.push({
				cx: acc.sumX / acc.count,
				cy: acc.sumY / acc.count,
				typeId: acc.typeId,
				type,
				regionId
			});
		}

		return result;
	}
}
