<script lang="ts">
	import { onMount } from 'svelte';
	import { CanvasEngine } from '$canvas/engine.js';
	import { FloorplanLayer } from '$canvas/renderers/floorplan.js';
	import { GridLayer } from '$canvas/renderers/grid.js';
	import { HeatmapLayer } from '$canvas/renderers/heatmap.js';
	import { ApLayer } from '$canvas/renderers/ap.js';
	import { WallLayer } from '$canvas/renderers/walls.js';
	import { PanZoomHandler } from '$canvas/interactions/pan-zoom.js';
	import { SelectHandler } from '$canvas/interactions/select.js';
	import { SelectionRectLayer } from '$canvas/renderers/selection-rect.js';
	import { DragHandler } from '$canvas/interactions/drag.js';
	import { PlaceHandler } from '$canvas/interactions/place.js';
	import { projectState, removeAps } from '$state/project.svelte.js';
	import { canvasState, clearSelection } from '$state/canvas.svelte.js';
	import { appState } from '$state/app.svelte.js';
	import { undo, redo } from '$state/history.svelte.js';
	import { solverState, runSolver } from '$state/solver.svelte.js';
	import { hitTest } from '$canvas/hit-test.js';
	import { setEngineRef } from '$canvas/engine-ref.js';
	import { restoreFromStorage } from '$state/persistence.svelte.js';
	import LayerPanel from '$components/canvas/LayerPanel.svelte';

	let canvasEl: HTMLCanvasElement;
	let containerEl: HTMLDivElement;
	let engine: CanvasEngine;
	let panZoom: PanZoomHandler;
	let selectHandler: SelectHandler;
	let dragHandler: DragHandler;
	let placeHandler: PlaceHandler;
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

	$effect(() => {
		if (!wallLayer) return;
		wallLayer.walls = projectState.walls.map((w) => ({
			x1: w.x1,
			y1: w.y1,
			x2: w.x2,
			y2: w.y2,
			thickness: w.thickness,
			material: w.material,
			attenuation: w.attenuation
		}));
		engine.markDirty();
	});

	$effect(() => {
		if (!heatmapLayer) return;
		heatmapLayer.walls = projectState.walls.map((w) => ({
			x1: w.x1,
			y1: w.y1,
			x2: w.x2,
			y2: w.y2,
			thickness: w.thickness,
			material: w.material,
			attenuation: w.attenuation
		}));
		engine.markDirty();
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


	// Track pending placement vs pan gesture
	const DRAG_THRESHOLD = 5; // px - beyond this, it's a drag/pan, not a tap
	let pendingPlace = false;
	let pendingPan = false;
	let pointerStartX = 0;
	let pointerStartY = 0;

	function handlePointerDown(e: PointerEvent) {
		if (!engine) return;
		if (e.button === 1) return; // middle click handled by pan-zoom

		const rect = engine.canvas.getBoundingClientRect();
		const screenPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
		const hit = hitTest(screenPoint, engine.camera, projectState.aps);

		if (hit) {
			// Clicked an existing AP: select and start drag
			selectHandler.handlePointerDown(e);
			dragHandler.handlePointerDown(e);
			pendingPlace = false;
			pendingPan = false;
		} else if (e.shiftKey) {
			// Shift+click on empty: box select
			selectHandler.handlePointerDown(e);
			pendingPlace = false;
			pendingPan = false;
		} else {
			// Clicked empty space: could be a tap (place) or drag (pan)
			// Defer the decision until we see movement or release
			pendingPlace = true;
			pendingPan = false;
			pointerStartX = e.clientX;
			pointerStartY = e.clientY;
			clearSelection();
			engine.markDirty();
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!engine) return;

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

		if (pendingPlace) {
			// Pointer released without significant movement: place an AP
			placeHandler.handlePointerDown(e);
			pendingPlace = false;
		}

		if (pendingPan) {
			pendingPan = false;
			engine.canvas.style.cursor = '';
		}

		selectHandler.handlePointerUp(e);
		dragHandler.handlePointerUp();
	}
</script>

<div class="canvas-container" bind:this={containerEl}>
	<canvas
		bind:this={canvasEl}
		role="application"
		aria-label="Channel planning canvas"
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
	></canvas>
	<LayerPanel />
	{#if showEmptyHint}
		<div class="empty-hint">
			<p>Drop a floorplan image here</p>
			<p>or click the canvas to place access points</p>
		</div>
	{/if}
</div>

<style>
	.canvas-container {
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--canvas-bg);
		position: relative;
	}

	canvas {
		display: block;
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
