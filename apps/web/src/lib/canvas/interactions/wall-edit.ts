import type { Point } from '@deconflict/geometry';
import type { CanvasEngine } from '../engine.js';
import type { WallMaterialId } from '../materials.js';
import { TiledMask } from '../tiled-mask.js';
import {
	applyRect,
	findNearestWall,
	findWallAlongRay,
	snapAngle,
	stampCapsule,
	type WallEditEffect
} from '../wall-shapes.js';
import { appState, type WallTool } from '$state/app.svelte.js';

export type PointerLike = { clientX: number; clientY: number };

export interface ShapePreview {
	tool: Exclude<WallTool, 'brush'>;
	effect: WallEditEffect;
	/** Fixed points of the shape in progress (polyline: all vertices so far). */
	vertices: Point[];
	/** Provisional point under the finger or cursor, after snapping. */
	cursor: Point | null;
	snappedToWall: boolean;
	willClose: boolean;
	radius: number;
	materialId: number;
}

/** Snap radius in screen pixels. */
const SNAP_PX_MOUSE = 12;
const SNAP_PX_TOUCH = 24;
/** Finger movement (screen px) before a touch brush stroke starts painting. */
const BRUSH_TOUCH_SLOP = 3;

export class WallEditHandler {
	private engine: CanvasEngine;
	private painting = false;
	private lastX = 0;
	private lastY = 0;

	// Touch brush stroke waiting to see whether it is a stroke or a pinch
	private pendingBrush: { sx: number; sy: number; wx: number; wy: number } | null = null;

	// Shape tool state
	private vertices: Point[] = [];
	private cursor: Point | null = null;
	private pressing = false;
	private snappedToWall = false;
	private willClose = false;
	private willFinish = false;

	/** Tiled mask for infinite-canvas wall drawing. */
	tiledMask: TiledMask | null = null;
	activeMaterial: WallMaterialId = 0;
	defaultMaterial: WallMaterialId = 0;

	// Called after edits to update renderers
	onEdit: (() => void) | null = null;

	constructor(engine: CanvasEngine) {
		this.engine = engine;
	}

	get canUndo(): boolean {
		return this.vertices.length > 0 || (this.tiledMask?.undoDepth ?? 0) > 0;
	}

	get preview(): ShapePreview | null {
		const tool = appState.wallTool;
		const effect = appState.wallEditMode;
		if (tool === 'brush' || !effect) return null;
		if (this.vertices.length === 0 && !this.cursor) return null;
		return {
			tool,
			effect,
			vertices: [...this.vertices],
			cursor: this.cursor,
			snappedToWall: this.snappedToWall,
			willClose: this.willClose,
			radius: appState.wallBrushSize,
			materialId: this.activeMaterial
		};
	}

	handlePointerDown(e: PointerLike, isTouch = false): void {
		if (!appState.wallEditMode || !this.tiledMask) return;
		const world = this.toWorld(e);
		if (appState.wallTool === 'brush') {
			if (isTouch) {
				this.pendingBrush = { sx: e.clientX, sy: e.clientY, wx: world.x, wy: world.y };
				return;
			}
			this.startBrush(world.x, world.y);
			return;
		}
		this.pressing = true;
		this.updateCursor(world, isTouch);
	}

	handlePointerMove(e: PointerLike, isTouch = false): void {
		if (!appState.wallEditMode || !this.tiledMask) return;
		const world = this.toWorld(e);
		if (appState.wallTool === 'brush') {
			const pending = this.pendingBrush;
			if (pending) {
				if (Math.hypot(e.clientX - pending.sx, e.clientY - pending.sy) <= BRUSH_TOUCH_SLOP) return;
				this.pendingBrush = null;
				this.startBrush(pending.wx, pending.wy);
			}
			if (this.painting) this.strokeTo(world.x, world.y);
			return;
		}
		// Touch only moves while pressed; the mouse also hovers
		if (isTouch && !this.pressing) return;
		this.updateCursor(world, isTouch);
	}

	handlePointerUp(e?: PointerLike, isTouch = false): void {
		if (appState.wallTool === 'brush' || !appState.wallEditMode || !this.tiledMask) {
			const pending = this.pendingBrush;
			if (pending && this.tiledMask && appState.wallEditMode) {
				this.pendingBrush = null;
				this.startBrush(pending.wx, pending.wy);
			}
			this.endBrush();
			return;
		}
		if (!this.pressing) return;
		if (e) this.updateCursor(this.toWorld(e), isTouch);
		this.pressing = false;
		const p = this.cursor;
		if (p) this.place(p);
		// The next mouse move recomputes the hover point
		this.cursor = null;
		this.snappedToWall = false;
		this.willClose = false;
		this.willFinish = false;
		this.changed();
	}

	/** A second finger arrived: drop the provisional point or pending stroke. */
	cancelGesture(): void {
		this.pendingBrush = null;
		this.endBrush();
		this.pressing = false;
		this.cursor = null;
		this.snappedToWall = false;
		this.willClose = false;
		this.willFinish = false;
		this.changed();
	}

	/** End the shape in progress without stamping anything else. */
	finishShape(): void {
		this.vertices = [];
		this.cursor = null;
		this.pressing = false;
		this.snappedToWall = false;
		this.willClose = false;
		this.willFinish = false;
		this.changed();
	}

	/** Undo the last step: an unstamped anchor, the last polyline segment or the last mask operation. */
	undo(): boolean {
		this.pendingBrush = null;
		this.endBrush();
		this.cursor = null;
		this.pressing = false;
		const mask = this.tiledMask;
		let done = false;
		let restored = false;
		if (this.vertices.length === 1) {
			this.vertices = [];
			done = true;
		} else if (this.vertices.length >= 2) {
			if (mask?.undoOp()) {
				this.vertices.pop();
				restored = true;
			} else {
				this.vertices = [];
			}
			done = true;
		} else if (mask?.undoOp()) {
			restored = true;
			done = true;
		}
		if (restored) this.onEdit?.();
		this.changed();
		return done;
	}

	resetHistory(): void {
		this.tiledMask?.clearHistory();
		this.changed();
	}

	// ─── Brush ──────────────────────────────────────────────────────────

	private startBrush(wx: number, wy: number): void {
		this.tiledMask?.beginOp();
		this.painting = true;
		this.lastX = wx;
		this.lastY = wy;
		this.paintAt(wx, wy);
	}

	private strokeTo(wx: number, wy: number): void {
		// Interpolate between last and current position for smooth strokes
		const dx = wx - this.lastX;
		const dy = wy - this.lastY;
		const dist = Math.sqrt(dx * dx + dy * dy);
		const step = Math.max(1, appState.wallBrushSize / 3);
		const steps = Math.ceil(dist / step);

		for (let i = 1; i <= steps; i++) {
			const t = i / steps;
			this.paintAt(this.lastX + dx * t, this.lastY + dy * t);
		}

		this.lastX = wx;
		this.lastY = wy;
	}

	private endBrush(): void {
		if (!this.painting) return;
		this.painting = false;
		this.tiledMask?.endOp();
		this.changed();
	}

	private paintAt(wx: number, wy: number): void {
		if (!this.tiledMask) return;

		const r = appState.wallBrushSize;
		const cx = Math.round(wx);
		const cy = Math.round(wy);
		const mode = appState.wallEditMode;
		const mask = this.tiledMask;

		if (mode === 'erase') {
			mask.paintCircle(cx, cy, r, 0);
		} else if (mode === 'draw') {
			mask.paintCircle(cx, cy, r, 1, this.activeMaterial);
		} else if (mode === 'material') {
			// Only paint material on existing wall pixels
			const x0 = cx - r;
			const y0 = cy - r;
			const x1 = cx + r;
			const y1 = cy + r;
			const r2 = r * r;
			for (let y = y0; y <= y1; y++) {
				for (let x = x0; x <= x1; x++) {
					if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r2) continue;
					if (mask.getPixel(x, y)) {
						mask.setMaterial(x, y, this.activeMaterial);
					}
				}
			}
			mask.markDirty();
		}

		this.onEdit?.();
		this.engine.markDirty();
	}

	// ─── Shapes ─────────────────────────────────────────────────────────

	/** Resolve the provisional point: angle snap, polyline vertices, then walls. */
	private updateCursor(world: Point, isTouch: boolean): void {
		const radius = (isTouch ? SNAP_PX_TOUCH : SNAP_PX_MOUSE) / this.engine.camera.state.zoom;
		const tool = appState.wallTool;
		const anchor = this.vertices.length > 0 ? this.vertices[this.vertices.length - 1]! : null;
		this.snappedToWall = false;
		this.willClose = false;
		this.willFinish = false;

		let q = world;
		if (anchor && appState.wallSnapAngles && (tool === 'line' || tool === 'polyline')) {
			q = snapAngle(anchor, world);
		}
		const angleSnapped = q !== world;

		if (tool === 'polyline' && anchor) {
			const first = this.vertices[0]!;
			if (this.vertices.length >= 2 && dist(q, first) <= radius) {
				this.cursor = first;
				this.willClose = true;
				this.engine.markDirty();
				return;
			}
			if (dist(q, anchor) <= radius) {
				this.cursor = anchor;
				this.willFinish = true;
				this.engine.markDirty();
				return;
			}
		}

		const view = this.tiledMask?.materialize() ?? null;
		if (view) {
			const hit =
				anchor && angleSnapped
					? findWallAlongRay(view, anchor, q, radius)
					: findNearestWall(view, q, radius, anchor ?? undefined);
			if (hit) {
				q = hit;
				this.snappedToWall = true;
			}
		}
		this.cursor = q;
		this.engine.markDirty();
	}

	private place(p: Point): void {
		const tool = appState.wallTool;
		if (this.vertices.length === 0) {
			this.vertices = [p];
			return;
		}
		const anchor = this.vertices[this.vertices.length - 1]!;
		if (tool === 'line') {
			this.stamp(() => this.stampSegment(anchor, p));
			this.vertices = [];
		} else if (tool === 'rect') {
			this.stamp(() => this.stampRect(anchor, p));
			this.vertices = [];
		} else if (this.willClose) {
			this.stamp(() => this.stampSegment(anchor, this.vertices[0]!));
			this.vertices = [];
		} else if (this.willFinish) {
			this.vertices = [];
		} else if (this.stamp(() => this.stampSegment(anchor, p))) {
			this.vertices.push(p);
		}
	}

	/** Run one undoable mask operation; returns true if it changed anything. */
	private stamp(fn: () => void): boolean {
		const mask = this.tiledMask;
		if (!mask || !appState.wallEditMode) return false;
		mask.beginOp();
		fn();
		const kept = mask.endOp();
		if (kept) {
			this.onEdit?.();
			this.engine.markDirty();
		}
		return kept;
	}

	private stampSegment(a: Point, b: Point): void {
		stampCapsule(
			this.tiledMask!,
			a,
			b,
			appState.wallBrushSize,
			appState.wallEditMode!,
			this.activeMaterial
		);
	}

	private stampRect(a: Point, b: Point): void {
		applyRect(
			this.tiledMask!,
			a,
			b,
			appState.wallBrushSize,
			appState.wallEditMode!,
			this.activeMaterial
		);
	}

	private toWorld(e: PointerLike): Point {
		const rect = this.engine.canvas.getBoundingClientRect();
		return this.engine.camera.screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
	}

	private changed(): void {
		appState.wallCanUndo = this.canUndo;
		this.engine.markDirty();
	}
}

function dist(a: Point, b: Point): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}
