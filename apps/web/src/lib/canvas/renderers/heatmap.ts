import type { Layer, RenderContext } from '../types.js';
import type { AccessPoint } from '$state/ap-state.svelte.js';
import type { DecodedWallMask } from '../wall-detect.js';
import type { WallMaterialId } from '../materials.js';
import { WALL_MATERIALS } from '../materials.js';

/**
 * Heatmap layer — renders signal coverage via Web Worker.
 *
 * Simple model:
 *  - Compute a state fingerprint each frame
 *  - If it differs from the last request sent, and no request is in-flight, send one
 *  - When a result arrives, store it and check if state changed; if so, send again
 *  - Always composite whatever cached frame we have (never null it out)
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
	floorplanBounds: { width: number; height: number } | null = null;
	wallMaskBounds: { width: number; height: number } | null = null;

	private worker: Worker | null = null;
	private cache: HTMLCanvasElement | null = null;
	private sentKey = '';
	private requestId = 0;
	private inFlight = false;
	private wallsDirty = true;
	private renderDirty: (() => void) | null = null;

	setDirtyCallback(fn: () => void): void {
		this.renderDirty = fn;
	}

	/** Mark walls as changed so they're re-sent to the worker. */
	markWallsDirty(): void {
		this.wallsDirty = true;
	}

	private getWorker(): Worker {
		if (!this.worker) {
			this.worker = new Worker(new URL('../../workers/heatmap-worker.ts', import.meta.url), {
				type: 'module'
			});
			this.worker.onmessage = (e: MessageEvent) => {
				const { type, id, buf, width, height } = e.data;
				if (type !== 'result' || id !== this.requestId) return;

				this.inFlight = false;

				// Create cache from result (skip if dimensions don't match buffer)
				const w = width | 0;
				const h = height | 0;
				if (buf && buf.byteLength === w * h * 4 && w > 0 && h > 0) {
					const offscreen = document.createElement('canvas');
					offscreen.width = w;
					offscreen.height = h;
					const ctx = offscreen.getContext('2d')!;
					ctx.putImageData(new ImageData(new Uint8ClampedArray(buf), w, h), 0, 0);
					this.cache = offscreen;
				}

				// State may have changed while computing — check and re-send
				this.renderDirty?.();
			};
		}
		return this.worker;
	}

	private syncWalls(): void {
		if (!this.wallsDirty) return;
		this.wallsDirty = false;

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

	private fingerprint(
		width: number,
		height: number,
		camera: { state: { zoom: number; x: number; y: number } }
	): string {
		return (
			this.aps
				.map(
					(ap) =>
						`${ap.id}:${Math.round(ap.x)}:${Math.round(ap.y)}:${ap.interferenceRadius}:${ap.band}:${ap.channelWidth}:${ap.assignedChannel}:${ap.power}`
				)
				.join('|') +
			`|isp:${this.ispSpeed}|wm:${this.wallMask?.width ?? 0}|mat:${this.defaultMaterial}|mv:${this.materialVersion}` +
			`|clip:${this.floorplanBounds?.width ?? this.wallMaskBounds?.width ?? this.wallMask?.width ?? 0}` +
			`|z:${camera.state.zoom.toFixed(3)}:x:${Math.round(camera.state.x * 10)}:y:${Math.round(camera.state.y * 10)}` +
			`|${width}x${height}`
		);
	}

	render(rc: RenderContext): void {
		if (this.aps.length === 0) return;

		const { camera, width, height } = rc;
		if (width <= 0 || height <= 0) return;

		// Send a new request if state changed and worker is free
		const key = this.fingerprint(width, height, camera);
		if (key !== this.sentKey && !this.inFlight) {
			this.sentKey = key;
			this.syncWalls();
			this.inFlight = true;

			const id = ++this.requestId;
			const inv = camera.getInverseTransform();
			const clipBounds = this.floorplanBounds
				? { x: 0, y: 0, w: this.floorplanBounds.width, h: this.floorplanBounds.height }
				: this.wallMaskBounds
					? { x: 0, y: 0, w: this.wallMaskBounds.width, h: this.wallMaskBounds.height }
					: this.wallMask
						? { x: 0, y: 0, w: this.wallMask.width, h: this.wallMask.height }
						: null;

			this.getWorker().postMessage({
				type: 'render',
				id,
				aps: this.aps.map((ap) => ({
					x: ap.x,
					y: ap.y,
					interferenceRadius: ap.interferenceRadius,
					band: ap.band,
					channelWidth: ap.channelWidth
				})),
				ispSpeed: this.ispSpeed,
				fast: this.isDragging,
				clipBounds,
				cameraInverse: Array.from(inv),
				viewWidth: width,
				viewHeight: height
			});
		}

		// Always composite whatever we have
		if (this.cache) {
			rc.compositeOffscreen(this.cache);
		}
	}
}
