import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/project.svelte.js';
import type { DecodedWallMask } from '../wall-detect.js';
import type { WallMaterialId } from '../materials.js';
import { WALL_MATERIALS } from '../materials.js';

/**
 * Heatmap layer — delegates computation to a Web Worker so the main thread
 * stays responsive during drag, zoom, and AP property edits.
 *
 * The worker receives AP positions, camera transform, and wall data, and
 * returns a pixel buffer. The main thread composites the result.
 */
export class HeatmapLayer implements Layer {
	id = 'heatmap';
	visible = false;
	aps: AccessPoint[] = [];
	ispSpeed = 0;
	wallMask: DecodedWallMask | null = null;
	wallAttenuation = 5;
	materialMap: Uint8Array | null = null;
	materialVersion = 0;
	defaultMaterial: WallMaterialId = 0;

	private worker: Worker | null = null;
	private cache: HTMLCanvasElement | null = null;
	private cacheKey = '';
	private pendingId = 0;
	private lastWallVersion = -1;
	private lastMaterialVersion = -1;
	private lastDefaultMaterial: WallMaterialId = -1 as WallMaterialId;
	private renderDirty: (() => void) | null = null;

	/** Provide a callback so the worker result can trigger a canvas repaint. */
	setDirtyCallback(fn: () => void): void {
		this.renderDirty = fn;
	}

	invalidateCache(): void {
		this.cacheKey = '';
	}

	private getWorker(): Worker {
		if (!this.worker) {
			this.worker = new Worker(new URL('../../workers/heatmap-worker.ts', import.meta.url), {
				type: 'module'
			});
			this.worker.onmessage = (e: MessageEvent) => {
				if (e.data.type === 'result' && e.data.id === this.pendingId) {
					const { buf, width, height } = e.data as {
						buf: ArrayBuffer;
						width: number;
						height: number;
					};
					const offscreen = document.createElement('canvas');
					offscreen.width = width;
					offscreen.height = height;
					const ctx = offscreen.getContext('2d')!;
					const imgData = new ImageData(new Uint8ClampedArray(buf), width, height);
					ctx.putImageData(imgData, 0, 0);
					this.cache = offscreen;
					this.renderDirty?.();
				}
			};
		}
		return this.worker;
	}

	private syncWalls(): void {
		const wallVer = (this.wallMask ? 1 : 0) * 1000 + this.materialVersion + this.defaultMaterial;
		if (wallVer === this.lastWallVersion && this.lastDefaultMaterial === this.defaultMaterial) {
			return;
		}
		this.lastWallVersion = wallVer;
		this.lastDefaultMaterial = this.defaultMaterial;

		const worker = this.getWorker();
		const matDb = WALL_MATERIALS.map((m) => m.attenuation);
		const defaultDb = WALL_MATERIALS[this.defaultMaterial]?.attenuation ?? this.wallAttenuation;

		if (this.wallMask) {
			const wallCopy = this.wallMask.data.slice();
			const matCopy = this.materialMap?.slice() ?? null;
			worker.postMessage(
				{
					type: 'setWalls',
					wallData: wallCopy.buffer,
					materialMap: matCopy?.buffer ?? null,
					materialDb: matDb,
					defaultDb,
					width: this.wallMask.width,
					height: this.wallMask.height
				},
				matCopy ? [wallCopy.buffer, matCopy.buffer] : [wallCopy.buffer]
			);
		} else {
			worker.postMessage({
				type: 'setWalls',
				wallData: null,
				materialMap: null,
				materialDb: matDb,
				defaultDb,
				width: 0,
				height: 0
			});
		}
	}

	private getCacheKey(
		camera: { state: { zoom: number; x: number; y: number } },
		width: number,
		height: number
	): string {
		return (
			this.aps
				.map(
					(ap) =>
						`${ap.id}:${Math.round(ap.x)}:${Math.round(ap.y)}:${ap.interferenceRadius}:${ap.band}:${ap.channelWidth}:${ap.assignedChannel}:${ap.power}`
				)
				.join('|') +
			`|isp:${this.ispSpeed}|wm:${this.wallMask ? 1 : 0}|mat:${this.defaultMaterial}|mv:${this.materialVersion}` +
			`|z:${camera.state.zoom.toFixed(3)}:x:${Math.round(camera.state.x * 10)}:y:${Math.round(camera.state.y * 10)}` +
			`|${width}x${height}`
		);
	}

	render(rc: RenderContext): void {
		if (this.aps.length === 0) return;

		const { camera, width, height } = rc;
		const key = this.getCacheKey(camera, width, height);

		if (key !== this.cacheKey) {
			this.cacheKey = key;
			this.requestRender(width, height, camera);
		}

		// Composite whatever we have (old frame while worker computes new one)
		if (this.cache) {
			rc.compositeOffscreen(this.cache);
		}
	}

	private requestRender(
		width: number,
		height: number,
		camera: { getInverseTransform: () => number[] }
	): void {
		this.syncWalls();

		const id = ++this.pendingId;
		const inv = camera.getInverseTransform();
		const aps = this.aps.map((ap) => ({
			x: ap.x,
			y: ap.y,
			interferenceRadius: ap.interferenceRadius,
			band: ap.band,
			channelWidth: ap.channelWidth
		}));

		this.getWorker().postMessage({
			type: 'render',
			id,
			aps,
			ispSpeed: this.ispSpeed,
			cameraInverse: Array.from(inv),
			viewWidth: width,
			viewHeight: height
		});
	}
}
