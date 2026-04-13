import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/project.svelte.js';
import type { DecodedWallMask } from '../wall-detect.js';
import type { WallMaterialId } from '../materials.js';
import { WALL_MATERIALS } from '../materials.js';

/**
 * Heatmap layer — delegates computation to a Web Worker.
 *
 * Uses a pipeline model: at most one render request in-flight.
 * When the worker finishes, if the state has changed, it immediately
 * sends the next request with the latest data. This prevents request
 * queueing (which causes lag during drag) while keeping the heatmap
 * as fresh as the worker can compute.
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

	isDragging = false;
	/** Clip heatmap to floorplan/mask bounds (world coords). null = no clipping. */
	floorplanBounds: { width: number; height: number } | null = null;
	/** Wall mask dimensions — used for clipping when no floorplan image. Set immediately (no async decode). */
	wallMaskBounds: { width: number; height: number } | null = null;

	private worker: Worker | null = null;
	private cache: HTMLCanvasElement | null = null;
	private cacheKey = '';
	private lastWallVersion = -1;
	private lastDefaultMaterial: WallMaterialId = -1 as WallMaterialId;
	private renderDirty: (() => void) | null = null;

	// Pipeline state: at most one request in-flight
	private pendingId = 0;
	private inFlight = false;
	private needsUpdate = false;
	private lastCamera: { getInverseTransform: () => number[] } | null = null;
	private lastWidth = 0;
	private lastHeight = 0;

	setDirtyCallback(fn: () => void): void {
		this.renderDirty = fn;
	}

	invalidateCache(): void {
		this.cacheKey = '';
	}

	/** Force a full-quality re-render (call on drag end). */
	notifyDragEnd(): void {
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

					// Validate buffer matches declared dimensions (race during resize)
					const expected = width * height * 4;
					if (!buf || buf.byteLength !== expected || width <= 0 || height <= 0) {
						this.inFlight = false;
						return;
					}

					const offscreen = document.createElement('canvas');
					offscreen.width = width;
					offscreen.height = height;
					const ctx = offscreen.getContext('2d')!;
					const imgData = new ImageData(new Uint8ClampedArray(buf), width, height);
					ctx.putImageData(imgData, 0, 0);
					this.cache = offscreen;

					// Pipeline: request completed. If state changed, send next immediately.
					this.inFlight = false;
					if (this.needsUpdate && this.lastCamera) {
						this.needsUpdate = false;
						this.sendRender(this.lastWidth, this.lastHeight, this.lastCamera);
					}

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
			`|isp:${this.ispSpeed}|wm:${this.wallMask ? 1 : 0}|mat:${this.defaultMaterial}|mv:${this.materialVersion}|clip:${this.floorplanBounds?.width ?? this.wallMaskBounds?.width ?? 0}` +
			`|z:${camera.state.zoom.toFixed(3)}:x:${Math.round(camera.state.x * 10)}:y:${Math.round(camera.state.y * 10)}` +
			`|${width}x${height}`
		);
	}

	render(rc: RenderContext): void {
		if (this.aps.length === 0) return;

		const { camera, width, height } = rc;
		if (width <= 0 || height <= 0) return;
		const key = this.getCacheKey(camera, width, height);

		if (key !== this.cacheKey) {
			this.cacheKey = key;
			this.lastCamera = camera;
			this.lastWidth = width;
			this.lastHeight = height;

			if (!this.inFlight) {
				// No request pending — send immediately
				this.sendRender(width, height, camera);
			} else {
				// Request in-flight — mark for update when it completes
				this.needsUpdate = true;
			}
		}

		if (this.cache) {
			rc.compositeOffscreen(this.cache);
		}
	}

	private sendRender(
		width: number,
		height: number,
		camera: { getInverseTransform: () => number[] }
	): void {
		this.syncWalls();
		this.inFlight = true;

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
			fast: this.isDragging,
			clipBounds: this.floorplanBounds
				? { x: 0, y: 0, w: this.floorplanBounds.width, h: this.floorplanBounds.height }
				: this.wallMaskBounds
					? { x: 0, y: 0, w: this.wallMaskBounds.width, h: this.wallMaskBounds.height }
					: null,
			cameraInverse: Array.from(inv),
			viewWidth: width,
			viewHeight: height
		});
	}
}
