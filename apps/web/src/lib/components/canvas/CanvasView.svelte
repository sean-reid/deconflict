<script lang="ts">
	import { onMount } from 'svelte';
	import { CanvasEngine } from '$canvas/engine.js';
	import { GridLayer } from '$canvas/renderers/grid.js';
	import { ApLayer } from '$canvas/renderers/ap.js';
	import { RangeRingLayer } from '$canvas/renderers/range-ring.js';
	import { PanZoomHandler } from '$canvas/interactions/pan-zoom.js';
	import { SelectHandler } from '$canvas/interactions/select.js';
	import { DragHandler } from '$canvas/interactions/drag.js';
	import { PlaceHandler } from '$canvas/interactions/place.js';
	import { projectState, removeAps } from '$state/project.svelte.js';
	import { canvasState, clearSelection } from '$state/canvas.svelte.js';
	import { appState } from '$state/app.svelte.js';
	import { undo, redo } from '$state/history.svelte.js';

	let canvasEl: HTMLCanvasElement;
	let containerEl: HTMLDivElement;
	let engine: CanvasEngine;
	let panZoom: PanZoomHandler;
	let selectHandler: SelectHandler;
	let dragHandler: DragHandler;
	let placeHandler: PlaceHandler;
	let apLayer: ApLayer;
	let rangeRingLayer: RangeRingLayer;
	let zoomPercent = $state(100);

	function handleKeyDown(e: KeyboardEvent) {
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
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);
		engine = new CanvasEngine(canvasEl);

		// Create layers
		const gridLayer = new GridLayer();
		rangeRingLayer = new RangeRingLayer();
		apLayer = new ApLayer();

		// Add layers in draw order: grid, range rings, APs
		engine.addLayer(gridLayer);
		engine.addLayer(rangeRingLayer);
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
		if (!apLayer) return;
		apLayer.visible = true;
		engine.markDirty();
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
