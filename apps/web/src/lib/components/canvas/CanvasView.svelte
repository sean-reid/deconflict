<script lang="ts">
	import { onMount } from 'svelte';
	import { CanvasEngine } from '$canvas/engine.js';
	import { FloorplanLayer } from '$canvas/renderers/floorplan.js';
	import { GridLayer } from '$canvas/renderers/grid.js';
	import { HeatmapLayer } from '$canvas/renderers/heatmap.js';
	import { ApLayer } from '$canvas/renderers/ap.js';
	import { WallLayer } from '$canvas/renderers/walls.js';
	import { decodeMask, encodeMask } from '$canvas/wall-detect.js';
	import { WallEditHandler } from '$canvas/interactions/wall-edit.js';
	import { PanZoomHandler } from '$canvas/interactions/pan-zoom.js';
	import { SelectHandler } from '$canvas/interactions/select.js';
	import { SelectionRectLayer } from '$canvas/renderers/selection-rect.js';
	import { DragHandler } from '$canvas/interactions/drag.js';
	import { PlaceHandler } from '$canvas/interactions/place.js';
	import { projectState, removeAps } from '$state/project.svelte.js';
	import { canvasState, clearSelection } from '$state/canvas.svelte.js';
	import { appState } from '$state/app.svelte.js';
	import { undo, redo, pushState } from '$state/history.svelte.js';
	import { solverState, runSolver } from '$state/solver.svelte.js';
	import { updateCoverage } from '$state/optimizer.svelte.js';
	import { hitTest } from '$canvas/hit-test.js';
	import { setEngineRef, setMaterialChangeHandler } from '$canvas/engine-ref.js';
	import { restoreFromStorage } from '$state/persistence.svelte.js';
	import { importFloorplanFile } from '$canvas/import-floorplan.js';
	import { labelWallBlobs, relabelBlob, encodeMaterialMask, decodeMaterialMask } from '$canvas/wall-labels.js';
	import { WALL_MATERIALS, type WallMaterialId } from '$canvas/materials.js';
	import { scheduleSave } from '$state/persistence.svelte.js';
	import LayerPanel from '$components/canvas/LayerPanel.svelte';
	import WallMaterialPopup from '$components/canvas/WallMaterialPopup.svelte';
	import WallEditToolbar from '$components/canvas/WallEditToolbar.svelte';

	let wallEditMaterial = $state<WallMaterialId>(0);

	function handleWallEditDone() {
		appState.wallEditMode = null;
		// Sync any material data created during painting
		if (wallEditHandler.materialData && !cachedMaterialData) {
			cachedMaterialData = wallEditHandler.materialData;
		}
		// Re-encode edited masks and persist
		if (cachedWallData && projectState.wallMask) {
			const { width, height } = projectState.wallMask;
			projectState.wallMask = { dataUrl: encodeMask(cachedWallData, width, height), width, height };
			if (cachedMaterialData) {
				projectState.materialMask = { dataUrl: encodeMaterialMask(cachedMaterialData, width, height), width, height };
			}
			wallLayer.invalidateCache();
			heatmapLayer.invalidateCache();
			heatmapLayer.materialVersion++;
			engine.markDirty();
			scheduleSave();
		}
	}

	let canvasDragOver = $state(false);

	function handleCanvasDrop(e: DragEvent) {
		e.preventDefault();
		canvasDragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) {
			importFloorplanFile(file);
			appState.sidebarPanel = 'floorplan';
			appState.sidebarOpen = true;
		}
	}

	function handleCanvasDragOver(e: DragEvent) {
		e.preventDefault();
		canvasDragOver = true;
	}

	function handleCanvasDragLeave() {
		canvasDragOver = false;
	}

	// Wall material popup state
	let wallPopup = $state<{ x: number; y: number; material: WallMaterialId; blobId: number } | null>(null);
	let cachedWallLabels: ReturnType<typeof labelWallBlobs> | null = null;
	let cachedMaterialData: Uint8Array | null = null;
	let cachedWallData: Uint8Array | null = null;

	function handleWallClick(screenX: number, screenY: number): boolean {
		if (!engine || !cachedWallData || !cachedWallLabels) return false;
		const world = engine.camera.screenToWorld({ x: screenX, y: screenY });
		const px = Math.round(world.x);
		const py = Math.round(world.y);
		const mask = projectState.wallMask;
		if (!mask || px < 0 || px >= mask.width || py < 0 || py >= mask.height) return false;
		const idx = py * mask.width + px;
		if (!cachedWallData[idx]) return false;

		const blobId = cachedWallLabels.labels[idx]!;
		if (blobId < 0) return false;

		const matId = cachedMaterialData ? (cachedMaterialData[idx] ?? projectState.wallMaterial) : projectState.wallMaterial;
		wallPopup = { x: screenX, y: screenY, material: matId as WallMaterialId, blobId };
		return true;
	}

	async function handleMaterialSelect(newMaterial: WallMaterialId) {
		if (!wallPopup || !cachedWallLabels || !projectState.wallMask) return;
		pushState(); // undo captures state before blob relabel
		const mask = projectState.wallMask;

		// Create or clone material mask
		if (!cachedMaterialData) {
			cachedMaterialData = new Uint8Array(mask.width * mask.height);
			cachedMaterialData.fill(projectState.wallMaterial);
		}

		relabelBlob(cachedWallLabels.labels, cachedMaterialData, wallPopup.blobId, newMaterial);

		// Update renderers immediately
		wallLayer.materialMap = cachedMaterialData;
		wallLayer.invalidateCache();
		heatmapLayer.materialMap = cachedMaterialData;
		heatmapLayer.materialVersion++;
		engine.markDirty();

		// Encode and persist
		const dataUrl = encodeMaterialMask(cachedMaterialData, mask.width, mask.height);
		projectState.materialMask = { dataUrl, width: mask.width, height: mask.height };
		scheduleSave();
	}

	let canvasEl: HTMLCanvasElement;
	let containerEl: HTMLDivElement;
	let engine: CanvasEngine;
	let panZoom: PanZoomHandler;
	let selectHandler: SelectHandler;
	let dragHandler: DragHandler;
	let placeHandler: PlaceHandler;
	let wallEditHandler: WallEditHandler;
	let floorplanLayer: FloorplanLayer;
	let gridLayer: GridLayer;
	let heatmapLayer: HeatmapLayer;
	let selectionRectLayer: SelectionRectLayer;
	let apLayer: ApLayer;
	let wallLayer: WallLayer;
	let autoSolveTimeout: ReturnType<typeof setTimeout> | null = null;
	let showEmptyHint = $derived(projectState.aps.length === 0 && !projectState.floorplanUrl);

	function handleKeyDown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
		const mod = e.metaKey || e.ctrlKey;

		if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
			e.preventDefault();
			redo();
			engine?.markDirty();
			return;
		}

		if (mod && (e.key === 'z' || e.key === 'Z')) {
			e.preventDefault();
			undo();
			engine?.markDirty();
			return;
		}

		if (e.key === 'Delete' || e.key === 'Backspace') {
			if (canvasState.selectedApIds.length > 0) {
				e.preventDefault();
				removeAps([...canvasState.selectedApIds]);
				clearSelection();
			}
		}

		if (isInput || mod) return;

		switch (e.key) {
			case 'g':
			case 'G':
				appState.showGrid = !appState.showGrid;
				break;
			case 'w':
			case 'W':
				appState.showWalls = !appState.showWalls;
				break;
			case 'h':
			case 'H':
				appState.showHeatmap = !appState.showHeatmap;
				break;
		}
	}

	onMount(() => {
		restoreFromStorage();
		window.addEventListener('keydown', handleKeyDown);
		engine = new CanvasEngine(canvasEl);
		setEngineRef(engine);
		setMaterialChangeHandler((id) => {
			wallLayer.defaultMaterial = id;
			wallLayer.invalidateCache();
			heatmapLayer.defaultMaterial = id;
			heatmapLayer.materialVersion++;
			heatmapLayer.invalidateCache();
			engine.markDirty();
		});

		// Create layers
		floorplanLayer = new FloorplanLayer();
		gridLayer = new GridLayer();
		heatmapLayer = new HeatmapLayer();
		wallLayer = new WallLayer();
		apLayer = new ApLayer();
		selectionRectLayer = new SelectionRectLayer();

		// Add layers in draw order: floorplan, boundary, grid, walls, heatmap, APs, selection rect
		engine.addLayer(floorplanLayer);
		engine.addLayer(gridLayer);
		engine.addLayer(wallLayer);
		engine.addLayer(heatmapLayer);
		engine.addLayer(apLayer);
		engine.addLayer(selectionRectLayer);

		// Create interaction handlers
		panZoom = new PanZoomHandler(engine);
		panZoom.attach();
		selectHandler = new SelectHandler(engine, selectionRectLayer);
		dragHandler = new DragHandler(engine);
		placeHandler = new PlaceHandler(engine);
		wallEditHandler = new WallEditHandler(engine);
		wallEditHandler.onEdit = () => {
			// Live update renderers during painting (before Done)
			if (cachedWallData) {
				wallLayer.invalidateCache();
			}
			engine.markDirty();
		};

		// Set up resize observer
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				engine.resize(width, height);
			}
		});
		observer.observe(containerEl);

		// Initial size
		const rect = containerEl.getBoundingClientRect();
		engine.resize(rect.width, rect.height);
		engine.start();

		// Track zoom for status bar
		const zoomInterval = setInterval(() => {
			canvasState.zoom = engine.camera.state.zoom;
		}, 100);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			engine.stop();
			panZoom.detach();
			observer.disconnect();
			clearInterval(zoomInterval);
		};
	});

	// Sync state to layers via $effect
	$effect(() => {
		if (!apLayer) return;
		apLayer.aps = projectState.aps;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.selectedIds = canvasState.selectedApIds;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.hoveredId = canvasState.hoveredApId;
		engine.markDirty();
	});

	$effect(() => {
		if (!gridLayer) return;
		gridLayer.visible = appState.showGrid;
		engine.markDirty();
	});

	$effect(() => {
		if (!gridLayer) return;
		gridLayer.worldUnitsPerMeter = projectState.calibration?.worldUnitsPerMeter ?? null;
		gridLayer.unitSystem = projectState.unitSystem;
		engine.markDirty();
	});

	$effect(() => {
		if (!heatmapLayer) return;
		heatmapLayer.visible = appState.showHeatmap;
		engine.markDirty();
	});

	$effect(() => {
		if (!heatmapLayer) return;
		heatmapLayer.aps = projectState.aps;
		heatmapLayer.ispSpeed = projectState.ispSpeed;
		engine.markDirty();
	});

	// Decode wall mask + material mask (async, only when data URLs actually change)
	let wallMaskVersion = 0;
	let lastWallMaskUrl: string | null = null;
	let lastMatMaskUrl: string | null = null;
	$effect(() => {
		if (!wallLayer || !heatmapLayer) return;
		const mask = projectState.wallMask;
		const matMask = projectState.materialMask;

		// Skip re-decode if the data URLs haven't changed (avoids stale overwrites)
		const wallUrl = mask?.dataUrl ?? null;
		const matUrl = matMask?.dataUrl ?? null;
		if (wallUrl === lastWallMaskUrl && matUrl === lastMatMaskUrl && cachedWallData) return;
		lastWallMaskUrl = wallUrl;
		lastMatMaskUrl = matUrl;

		wallMaskVersion++;
		const thisVersion = wallMaskVersion;

		if (!mask) {
			wallLayer.mask = null;
			heatmapLayer.wallMask = null;
			cachedWallData = null;
			cachedWallLabels = null;
			cachedMaterialData = null;
			engine.markDirty();
			return;
		}

		const wallPromise = decodeMask(mask.dataUrl, mask.width, mask.height);
		const matPromise = matMask ? decodeMaterialMask(matMask.dataUrl, matMask.width, matMask.height) : null;

		wallPromise.then(async (decoded) => {
			if (wallMaskVersion !== thisVersion) return;
			const matData = matPromise ? await matPromise : null;
			if (wallMaskVersion !== thisVersion) return;

			const defaultMat = projectState.wallMaterial;
			wallLayer.mask = decoded;
			wallLayer.materialMap = matData ?? null;
			wallLayer.defaultMaterial = defaultMat;
			heatmapLayer.wallMask = decoded;
			heatmapLayer.materialMap = matData ?? null;
			heatmapLayer.defaultMaterial = defaultMat;
			heatmapLayer.wallAttenuation = projectState.wallAttenuation;

			cachedWallData = decoded.data;
			cachedWallLabels = labelWallBlobs(decoded.data, decoded.width, decoded.height);
			cachedMaterialData = matData ?? null;

			// Wire wall edit handler with live mask data
			if (wallEditHandler) {
				wallEditHandler.wallData = decoded.data;
				wallEditHandler.materialData = cachedMaterialData;
				wallEditHandler.maskWidth = decoded.width;
				wallEditHandler.maskHeight = decoded.height;
			}

			engine.markDirty();
		});
	});


	$effect(() => {
		if (!wallLayer) return;
		wallLayer.visible = appState.showWalls;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.showLabels = appState.showLabels;
		engine.markDirty();
	});

	$effect(() => {
		if (!floorplanLayer) return;
		floorplanLayer.visible = appState.showFloorplan;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.visible = appState.showAPs;
		engine.markDirty();
	});

	// Sync floorplan image to layer
	$effect(() => {
		if (!floorplanLayer) return;
		const url = projectState.floorplanUrl;
		if (url) {
			floorplanLayer.loadImage(url, () => {
				engine.markDirty();
			});
		} else {
			floorplanLayer.clearImage();
		}
		engine.markDirty();
	});

	// Sync floorplan opacity (stored in floorplanScale)
	$effect(() => {
		if (!floorplanLayer) return;
		floorplanLayer.opacity = projectState.floorplanScale;
		engine.markDirty();
	});


	// Auto-solve: debounce solver runs when APs change
	// Auto-solve: only re-run when AP layout changes (count, positions, radii)
	// NOT when channel assignments change (which would cause infinite loops)
	let autoSolveKey = $derived(
		projectState.aps
			.map((ap) => `${ap.id}:${Math.round(ap.x)}:${Math.round(ap.y)}:${ap.interferenceRadius}`)
			.join('|')
	);

	$effect(() => {
		const auto = solverState.autoSolve;
		const _key = autoSolveKey;
		if (!auto || projectState.aps.length === 0) return;
		if (solverState.isRunning) return;

		if (autoSolveTimeout) clearTimeout(autoSolveTimeout);
		autoSolveTimeout = setTimeout(() => {
			runSolver();
		}, 500);
	});


	// Update coverage score when APs or wall mask change
	let coverageTimeout: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const _key = autoSolveKey;
		const _mask = projectState.wallMask;
		if (projectState.aps.length === 0 || !_mask) return;
		if (coverageTimeout) clearTimeout(coverageTimeout);
		coverageTimeout = setTimeout(() => updateCoverage(), 300);
	});

	// Track pending placement vs pan gesture
	const DRAG_THRESHOLD = 5;
	let pendingPlace = false;
	let pendingPan = false;
	let pointerStartX = 0;
	let pointerStartY = 0;
	let activeTouches = 0;

	// Single-finger state
	let touchStartX = 0;
	let touchStartY = 0;
	let touchMoved = false;
	let touchStartedOnAp = false;

	// Two-finger pinch state
	let pinchLastDist = 0;
	let pinchLastCx = 0;
	let pinchLastCy = 0;
	let pinchFrames = 0;

	function handleTouchStart(e: TouchEvent) {
		activeTouches = e.touches.length;

		if (activeTouches === 1) {
			const t = e.touches[0]!;
			touchStartX = t.clientX;
			touchStartY = t.clientY;
			touchMoved = false;
			touchStartedOnAp = false;
			pendingPan = false;
		} else if (activeTouches >= 2) {
			e.preventDefault();
			// Cancel single-finger state
			pendingPan = false;
			touchStartedOnAp = false;
			touchMoved = true;
			dragHandler.handlePointerUp();
			// Initialize pinch
			pinchFrames = 0;
			pinchLastDist = 0;
		}
	}

	function handleTouchMove(e: TouchEvent) {
		if (!engine) return;

		// Two-finger: pinch zoom + pan
		if (e.touches.length === 2) {
			e.preventDefault();
			const t0 = e.touches[0]!;
			const t1 = e.touches[1]!;
			const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
			const cx = (t0.clientX + t1.clientX) / 2;
			const cy = (t0.clientY + t1.clientY) / 2;

			pinchFrames++;
			if (pinchFrames <= 2) {
				// Baseline frames: record, don't apply
				pinchLastDist = dist;
				pinchLastCx = cx;
				pinchLastCy = cy;
				return;
			}

			// Zoom
			if (pinchLastDist > 0) {
				const factor = dist / pinchLastDist;
				const rect = engine.canvas.getBoundingClientRect();
				engine.camera.zoomAt({ x: cx - rect.left, y: cy - rect.top }, factor);
			}

			// Pan
			engine.camera.pan(
				(cx - pinchLastCx) / engine.camera.state.zoom,
				(cy - pinchLastCy) / engine.camera.state.zoom
			);

			pinchLastDist = dist;
			pinchLastCx = cx;
			pinchLastCy = cy;
			engine.markDirty();
			return;
		}

		// Single-finger
		if (e.touches.length !== 1) return;
		const t = e.touches[0]!;
		const dx = t.clientX - touchStartX;
		const dy = t.clientY - touchStartY;

		if (!touchMoved && !touchStartedOnAp && !pendingPan && dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
			touchMoved = true;
			const rect = engine.canvas.getBoundingClientRect();
			const hit = hitTest({ x: touchStartX - rect.left, y: touchStartY - rect.top }, engine.camera, projectState.aps);

			if (hit) {
				touchStartedOnAp = true;
				const synth = new PointerEvent('pointerdown', { clientX: touchStartX, clientY: touchStartY, button: 0 });
				selectHandler.handlePointerDown(synth);
				dragHandler.handlePointerDown(synth);
			} else {
				pendingPan = true;
				pointerStartX = touchStartX;
				pointerStartY = touchStartY;
			}
		}

		if (touchStartedOnAp && dragHandler.isDragging) {
			dragHandler.handlePointerMove(new PointerEvent('pointermove', { clientX: t.clientX, clientY: t.clientY }));
		} else if (pendingPan) {
			engine.camera.pan(
				(t.clientX - pointerStartX) / engine.camera.state.zoom,
				(t.clientY - pointerStartY) / engine.camera.state.zoom
			);
			pointerStartX = t.clientX;
			pointerStartY = t.clientY;
			engine.markDirty();
		}
	}

	function handleTouchEnd(e: TouchEvent) {
		if (activeTouches === 1 && e.touches.length === 0) {
			if (!touchMoved && engine) {
				const rect = engine.canvas.getBoundingClientRect();
				const hit = hitTest({ x: touchStartX - rect.left, y: touchStartY - rect.top }, engine.camera, projectState.aps);

				if (hit) {
					selectHandler.handlePointerDown(new PointerEvent('pointerdown', { clientX: touchStartX, clientY: touchStartY, button: 0 }));
				} else {
					placeHandler.handlePointerDown(new PointerEvent('pointerdown', { clientX: touchStartX, clientY: touchStartY, button: 0 }));
				}
			}
			pendingPan = false;
			touchStartedOnAp = false;
			dragHandler.handlePointerUp();
			selectHandler.handlePointerUp(new PointerEvent('pointerup'));
		}
		activeTouches = e.touches.length;
		if (activeTouches === 0) {
			pinchFrames = 0;
			pinchLastDist = 0;
		}
	}

	function processPointerDown(e: PointerEvent) {
		if (!engine) return;
		if (activeTouches >= 2) return;

		const rect = engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const hit = hitTest(screenPoint, engine.camera, projectState.aps);

		if (hit) {
			selectHandler.handlePointerDown(e);
			dragHandler.handlePointerDown(e);
			pendingPlace = false;
			pendingPan = false;
		} else if (e.shiftKey) {
			selectHandler.handlePointerDown(e);
			pendingPlace = false;
			pendingPan = false;
		} else {
			pendingPlace = true;
			pendingPan = false;
			pointerStartX = e.clientX;
			pointerStartY = e.clientY;
		}
	}

	function handlePointerDown(e: PointerEvent) {
		if (!engine) return;
		if (e.button === 1) return;
		if (e.pointerType === 'touch') return;
		// Wall edit mode intercepts primary pointer
		if (appState.wallEditMode) {
			wallEditHandler.activeMaterial = wallEditMaterial;
			wallEditHandler.handlePointerDown(e);
			return;
		}
		processPointerDown(e);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!engine) return;
		if (e.pointerType === 'touch') return;
		if (appState.wallEditMode) {
			wallEditHandler.handlePointerMove(e);
			return;
		}

		if (dragHandler.isDragging) {
			dragHandler.handlePointerMove(e);
			return;
		}

		if (pendingPlace) {
			const dx = e.clientX - pointerStartX;
			const dy = e.clientY - pointerStartY;
			if (dx * dx + dy * dy > DRAG_THRESHOLD * DRAG_THRESHOLD) {
				// Moved beyond threshold: this is a pan, not a tap-to-place
				pendingPlace = false;
				pendingPan = true;
				// Start panning from the original position
				engine.canvas.style.cursor = 'grabbing';
			}
		}

		if (pendingPan) {
			const dx = (e.clientX - pointerStartX) / engine.camera.state.zoom;
			const dy = (e.clientY - pointerStartY) / engine.camera.state.zoom;
			engine.camera.pan(dx, dy);
			pointerStartX = e.clientX;
			pointerStartY = e.clientY;
			engine.markDirty();
			return;
		}

		selectHandler.handlePointerMove(e);
	}

	function handlePointerUp(e: PointerEvent) {
		if (!engine) return;
		if (appState.wallEditMode) {
			wallEditHandler.handlePointerUp();
			return;
		}

		if (pendingPlace) {
			pendingPlace = false;
			// Check if click was on a wall pixel first (for material popup)
			const rect = engine.canvas.getBoundingClientRect();
			const sx = e.clientX - rect.left;
			const sy = e.clientY - rect.top;
			if (!handleWallClick(sx, sy)) {
				// Not a wall click — place an AP
				placeHandler.handlePointerDown(e);
			}
		}

		if (pendingPan) {
			pendingPan = false;
			engine.canvas.style.cursor = '';
		}

		selectHandler.handlePointerUp(e);
		dragHandler.handlePointerUp();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="canvas-container"
	class:drag-over={canvasDragOver}
	bind:this={containerEl}
	ondrop={handleCanvasDrop}
	ondragover={handleCanvasDragOver}
	ondragleave={handleCanvasDragLeave}
>
	<canvas
		bind:this={canvasEl}
		role="application"
		aria-label="Channel planning canvas"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
		ontouchcancel={handleTouchEnd}
	></canvas>
	<LayerPanel />
	{#if appState.wallEditMode}
		<WallEditToolbar bind:activeMaterial={wallEditMaterial} ondone={handleWallEditDone} />
	{/if}
	{#if showEmptyHint}
		<div class="empty-hint">
			<p>Drop a floorplan image here</p>
			<p>or click the canvas to place access points</p>
		</div>
	{/if}
</div>

{#if wallPopup}
	<WallMaterialPopup
		x={wallPopup.x}
		y={wallPopup.y}
		currentMaterial={wallPopup.material}
		onselect={handleMaterialSelect}
		onclose={() => { wallPopup = null; }}
	/>
{/if}

<style>
	.canvas-container {
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--canvas-bg);
		position: relative;
	}

	.canvas-container.drag-over {
		outline: 3px dashed var(--accent-primary);
		outline-offset: -3px;
	}

	canvas {
		display: block;
		touch-action: none;
	}

	.empty-hint {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		gap: var(--space-1, 4px);
	}

	.empty-hint p {
		margin: 0;
		font-size: var(--text-base);
		color: var(--text-tertiary);
		opacity: 0.6;
	}

</style>
