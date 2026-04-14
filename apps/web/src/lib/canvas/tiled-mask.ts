/**
 * Tiled binary mask for infinite-canvas wall drawing.
 *
 * Storage: sparse Map of 256×256 tiles. Only non-empty tiles consume memory.
 * Computation: materialize() flattens to a Uint8Array for hot-path consumers
 * (ray march, renderer, BFS) — same speed as a monolithic array.
 *
 * Supports negative coordinates. Materialized origin tracks the bounding box.
 */

const TILE_SIZE = 256;
const TILE_PIXELS = TILE_SIZE * TILE_SIZE;

function tileKey(tx: number, ty: number): string {
	return `${tx},${ty}`;
}

/** Proper floor division that handles negatives (JS % is remainder, not modulo). */
function floorDiv(n: number, d: number): number {
	return Math.floor(n / d);
}

function mod(n: number, d: number): number {
	return ((n % d) + d) % d;
}

export interface MaterialTiledMask {
	tiles: Map<string, Uint8Array>;
	defaultValue: number;
}

export class TiledMask {
	tiles = new Map<string, Uint8Array>();
	/** Optional per-pixel material data (same tile layout). */
	materialTiles: MaterialTiledMask | null = null;

	// Bounding box of all non-empty tiles (in world pixels)
	private minTX = Infinity;
	private minTY = Infinity;
	private maxTX = -Infinity;
	private maxTY = -Infinity;
	private dirty = true;

	/** Minimum bounds the materialization must cover (e.g., original mask dimensions). */
	minBoundsWidth = 0;
	minBoundsHeight = 0;

	// Cached flat materialization
	private cachedData: Uint8Array | null = null;
	private cachedMaterial: Uint8Array | null = null;
	private cachedOriginX = 0;
	private cachedOriginY = 0;
	private cachedWidth = 0;
	private cachedHeight = 0;

	/** Read a single pixel (for non-hot-path use). */
	getPixel(x: number, y: number): number {
		const tx = floorDiv(x, TILE_SIZE);
		const ty = floorDiv(y, TILE_SIZE);
		const tile = this.tiles.get(tileKey(tx, ty));
		if (!tile) return 0;
		const lx = mod(x, TILE_SIZE);
		const ly = mod(y, TILE_SIZE);
		return tile[ly * TILE_SIZE + lx]!;
	}

	/** Write a single pixel. Allocates tile on first write. */
	setPixel(x: number, y: number, value: number): void {
		const tx = floorDiv(x, TILE_SIZE);
		const ty = floorDiv(y, TILE_SIZE);
		const key = tileKey(tx, ty);
		let tile = this.tiles.get(key);
		if (!tile) {
			tile = new Uint8Array(TILE_PIXELS);
			this.tiles.set(key, tile);
		}
		const lx = mod(x, TILE_SIZE);
		const ly = mod(y, TILE_SIZE);
		tile[ly * TILE_SIZE + lx] = value;
		this.dirty = true;

		// Update bounding box
		if (tx < this.minTX) this.minTX = tx;
		if (ty < this.minTY) this.minTY = ty;
		if (tx > this.maxTX) this.maxTX = tx;
		if (ty > this.maxTY) this.maxTY = ty;
	}

	/** Set a material value for a pixel. */
	setMaterial(x: number, y: number, materialId: number): void {
		if (!this.materialTiles) {
			this.materialTiles = { tiles: new Map(), defaultValue: 0 };
		}
		const tx = floorDiv(x, TILE_SIZE);
		const ty = floorDiv(y, TILE_SIZE);
		const key = tileKey(tx, ty);
		let tile = this.materialTiles.tiles.get(key);
		if (!tile) {
			tile = new Uint8Array(TILE_PIXELS);
			tile.fill(this.materialTiles.defaultValue);
			this.materialTiles.tiles.set(key, tile);
		}
		const lx = mod(x, TILE_SIZE);
		const ly = mod(y, TILE_SIZE);
		tile[ly * TILE_SIZE + lx] = materialId;
		this.dirty = true;
	}

	/** Paint a filled circle of wall pixels (brush stroke). */
	paintCircle(cx: number, cy: number, radius: number, value: number, materialId?: number): void {
		const r2 = radius * radius;
		const x0 = cx - radius;
		const y0 = cy - radius;
		const x1 = cx + radius;
		const y1 = cy + radius;
		for (let y = y0; y <= y1; y++) {
			for (let x = x0; x <= x1; x++) {
				const dx = x - cx;
				const dy = y - cy;
				if (dx * dx + dy * dy <= r2) {
					this.setPixel(x, y, value);
					if (materialId !== undefined && value === 1) {
						this.setMaterial(x, y, materialId);
					}
				}
			}
		}
	}

	/** Check if the mask has any tiles with data. */
	get isEmpty(): boolean {
		return this.tiles.size === 0;
	}

	/** Get the bounding box in world pixels (includes minBounds). */
	get bounds(): { originX: number; originY: number; width: number; height: number } | null {
		if (this.minTX > this.maxTX && this.minBoundsWidth <= 0) return null;
		const tileOX = this.minTX <= this.maxTX ? this.minTX * TILE_SIZE : 0;
		const tileOY = this.minTY <= this.maxTY ? this.minTY * TILE_SIZE : 0;
		const tileW = this.minTX <= this.maxTX ? (this.maxTX - this.minTX + 1) * TILE_SIZE : 0;
		const tileH = this.minTY <= this.maxTY ? (this.maxTY - this.minTY + 1) * TILE_SIZE : 0;
		const originX = Math.min(tileOX, 0);
		const originY = Math.min(tileOY, 0);
		const endX = Math.max(tileOX + tileW, this.minBoundsWidth);
		const endY = Math.max(tileOY + tileH, this.minBoundsHeight);
		return {
			originX,
			originY,
			width: endX - originX,
			height: endY - originY
		};
	}

	/**
	 * Materialize tiles into a flat Uint8Array for hot-path consumers.
	 * Returns cached result if unchanged since last call. Cost: <1ms for typical masks.
	 */
	materialize(): {
		data: Uint8Array;
		materialData: Uint8Array | null;
		originX: number;
		originY: number;
		width: number;
		height: number;
	} | null {
		if (!this.dirty && this.cachedData) {
			return {
				data: this.cachedData,
				materialData: this.cachedMaterial,
				originX: this.cachedOriginX,
				originY: this.cachedOriginY,
				width: this.cachedWidth,
				height: this.cachedHeight
			};
		}

		const b = this.bounds;
		if (!b) return null;

		const { originX, originY, width, height } = b;
		const data = new Uint8Array(width * height);
		const matData =
			this.materialTiles && this.materialTiles.tiles.size > 0
				? new Uint8Array(width * height)
				: null;
		if (matData && this.materialTiles) {
			matData.fill(this.materialTiles.defaultValue);
		}

		// Copy tile data into flat array
		for (const [key, tile] of this.tiles) {
			const [txStr, tyStr] = key.split(',');
			const tx = Number(txStr);
			const ty = Number(tyStr);
			const baseX = tx * TILE_SIZE - originX;
			const baseY = ty * TILE_SIZE - originY;
			for (let ly = 0; ly < TILE_SIZE; ly++) {
				const srcOff = ly * TILE_SIZE;
				const dstOff = (baseY + ly) * width + baseX;
				data.set(tile.subarray(srcOff, srcOff + TILE_SIZE), dstOff);
			}
		}

		// Copy material tiles
		if (matData && this.materialTiles) {
			for (const [key, tile] of this.materialTiles.tiles) {
				const [txStr, tyStr] = key.split(',');
				const tx = Number(txStr);
				const ty = Number(tyStr);
				const baseX = tx * TILE_SIZE - originX;
				const baseY = ty * TILE_SIZE - originY;
				for (let ly = 0; ly < TILE_SIZE; ly++) {
					const srcOff = ly * TILE_SIZE;
					const dstOff = (baseY + ly) * width + baseX;
					matData.set(tile.subarray(srcOff, srcOff + TILE_SIZE), dstOff);
				}
			}
		}

		this.cachedData = data;
		this.cachedMaterial = matData;
		this.cachedOriginX = originX;
		this.cachedOriginY = originY;
		this.cachedWidth = width;
		this.cachedHeight = height;
		this.dirty = false;

		return {
			data,
			materialData: matData,
			originX,
			originY,
			width,
			height
		};
	}

	/** Import from a flat Uint8Array (legacy format, origin at 0,0). */
	static fromFlat(
		data: Uint8Array,
		width: number,
		height: number,
		materialData?: Uint8Array | null,
		defaultMaterial?: number
	): TiledMask {
		const mask = new TiledMask();
		mask.minBoundsWidth = width;
		mask.minBoundsHeight = height;
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (data[y * width + x]) {
					mask.setPixel(x, y, 1);
				}
			}
		}
		if (materialData) {
			if (!mask.materialTiles) {
				mask.materialTiles = {
					tiles: new Map(),
					defaultValue: defaultMaterial ?? 0
				};
			}
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const val = materialData[y * width + x]!;
					if (val !== (defaultMaterial ?? 0) || data[y * width + x]) {
						mask.setMaterial(x, y, val);
					}
				}
			}
		}
		return mask;
	}

	/** Mark as dirty so next materialize() rebuilds the flat array. */
	markDirty(): void {
		this.dirty = true;
	}
}
