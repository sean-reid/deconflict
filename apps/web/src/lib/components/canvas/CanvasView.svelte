<script lang="ts">
	import { onMount } from 'svelte';
	import { CanvasEngine } from '$canvas/engine.js';
	import { GridLayer } from '$canvas/renderers/grid.js';
	import { ApLayer } from '$canvas/renderers/ap.js';
	import { RangeRingLayer } from '$canvas/renderers/range-ring.js';
	import { ConflictEdgeLayer } from '$canvas/renderers/conflict-edge.js';
	import { buildInterferenceGraph } from '@deconflict/geometry';
	import { PanZoomHandler } from '$canvas/interactions/pan-zoom.js';
	import { SelectHandler } from '$canvas/interactions/select.js';
	import { DragHandler } from '$canvas/interactions/drag.js';
	import { PlaceHandler } from '$canvas/interactions/place.js';
	import { projectState, removeAps } from '$state/project.svelte.js';
	import { canvasState, clearSelection } from '$state/canvas.svelte.js';
	import { appState } from '$state/app.svelte.js';
	import { undo, redo } from '$state/history.svelte.js';
	import { solverState, runSolver } from '$state/solver.svelte.js';

	let canvasEl: HTMLCanvasElement;
	let containerEl: HTMLDivElement;
	let engine: CanvasEngine;
	let panZoom: PanZoomHandler;
	let selectHandler: SelectHandler;
	let dragHandler: DragHandler;
	let placeHandler: PlaceHandler;
	let apLayer: ApLayer;
	let rangeRingLayer: RangeRingLayer;
	let conflictEdgeLayer: ConflictEdgeLayer;
	let zoomPercent = $state(100);
	let autoSolveTimeout: ReturnType<typeof setTimeout> | null = null;

	function handleKeyDown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
		const mod = e.metaKey || e.ctrlKey;

		if (mod && e.shiftKey && e.key === 'z') {
			e.preventDefault();
			redo();
			return;
		}

		if (mod && e.key === 'z') {
			e.preventDefault();
			undo();
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
			case 'v':
			case 'V':
				appState.activeTool = 'select';
				break;
			case 'p':
			case 'P':
				appState.activeTool = 'place';
				break;
			case 'h':
			case 'H':
				appState.activeTool = 'pan';
				break;
			case 'g':
			case 'G':
				appState.showGrid = !appState.showGrid;
				break;
			case 'r':
			case 'R':
				appState.showRangeRings = !appState.showRangeRings;
				break;
			case 'e':
			case 'E':
				appState.showConflictEdges = !appState.showConflictEdges;
				break;
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		engine = new CanvasEngine(canvasEl);

		// Create layers
		const gridLayer = new GridLayer();
		rangeRingLayer = new RangeRingLayer();
		conflictEdgeLayer = new ConflictEdgeLayer();
		apLayer = new ApLayer();

		// Add layers in draw order: grid, range rings, conflict edges, APs
		engine.addLayer(gridLayer);
		engine.addLayer(rangeRingLayer);
		engine.addLayer(conflictEdgeLayer);
		engine.addLayer(apLayer);

		// Create interaction handlers
		panZoom = new PanZoomHandler(engine);
		panZoom.attach();
		selectHandler = new SelectHandler(engine);
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
			zoomPercent = engine.camera.getZoomPercent();
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
		if (!rangeRingLayer) return;
		rangeRingLayer.aps = projectState.aps;
		engine.markDirty();
	});

	$effect(() => {
		if (!rangeRingLayer) return;
		rangeRingLayer.visible = appState.showRangeRings;
		engine.markDirty();
	});

	$effect(() => {
		if (!conflictEdgeLayer) return;
		const aps = projectState.aps;
		const apPositions = aps.map((ap) => ({
			id: ap.id,
			x: ap.x,
			y: ap.y,
			interferenceRadius: ap.interferenceRadius
		}));
		const { edges } = buildInterferenceGraph(apPositions);
		const apMap = new Map(aps.map((ap) => [ap.id, ap]));

		conflictEdgeLayer.edges = edges.map((edge) => {
			const apA = apMap.get(edge.a);
			const apB = apMap.get(edge.b);
			const isConflict =
				apA != null &&
				apB != null &&
				apA.assignedChannel != null &&
				apB.assignedChannel != null &&
				apA.assignedChannel === apB.assignedChannel;
			return { aId: edge.a, bId: edge.b, isConflict };
		});
		conflictEdgeLayer.aps = aps;
		engine.markDirty();
	});

	$effect(() => {
		if (!conflictEdgeLayer) return;
		conflictEdgeLayer.visible = appState.showConflictEdges;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.visible = true;
		engine.markDirty();
	});

	$effect(() => {
		if (!apLayer) return;
		apLayer.showLabels = appState.showLabels;
		engine.markDirty();
	});

	// Auto-solve: debounce solver runs when APs change
	$effect(() => {
		const auto = solverState.autoSolve;
		const aps = projectState.aps;
		if (!auto || aps.length === 0) return;
		if (solverState.isRunning) return;

		if (autoSolveTimeout) clearTimeout(autoSolveTimeout);
		autoSolveTimeout = setTimeout(() => {
			runSolver();
		}, 500);
	});

	// Cursor based on active tool
	$effect(() => {
		if (!canvasEl) return;
		switch (appState.activeTool) {
			case 'place':
				canvasEl.style.cursor = 'crosshair';
				break;
			case 'pan':
				canvasEl.style.cursor = 'grab';
				break;
			case 'select':
			default:
				canvasEl.style.cursor = 'default';
				break;
		}
	});

	function handlePointerDown(e: PointerEvent) {
		if (!engine) return;

		// Let pan-zoom handle middle click / space internally
		if (e.button === 1) return;

		const tool = appState.activeTool;

		if (tool === 'place') {
			placeHandler.handlePointerDown(e);
		} else if (tool === 'select') {
			// Try drag first (on selected AP)
			if (!dragHandler.handlePointerDown(e)) {
				// Fall through to select/deselect
				selectHandler.handlePointerDown(e);
			}
		}
	}

	function handlePointerMove(e: PointerEvent) {
		if (!engine) return;

		const tool = appState.activeTool;

		if (tool === 'select') {
			if (dragHandler.isDragging) {
				dragHandler.handlePointerMove(e);
			} else {
				selectHandler.handlePointerMove(e);
			}
		}
	}

	function handlePointerUp(_e: PointerEvent) {
		if (!engine) return;
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
</div>

<style>
	.canvas-container {
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--canvas-bg);
	}

	canvas {
		display: block;
	}
</style>
