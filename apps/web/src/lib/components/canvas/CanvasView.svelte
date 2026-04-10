<script lang="ts">
	import { onMount } from 'svelte';
	import { CanvasEngine } from '$canvas/engine.js';
	import { GridLayer } from '$canvas/renderers/grid.js';
	import { PanZoomHandler } from '$canvas/interactions/pan-zoom.js';

	let canvasEl: HTMLCanvasElement;
	let containerEl: HTMLDivElement;
	let engine: CanvasEngine;
	let panZoom: PanZoomHandler;
	let zoomPercent = $state(100);

	onMount(() => {
		engine = new CanvasEngine(canvasEl);
		engine.addLayer(new GridLayer());

		panZoom = new PanZoomHandler(engine);
		panZoom.attach();

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

		// Track zoom for status bar (poll would be cleaner but this works)
		const zoomInterval = setInterval(() => {
			zoomPercent = engine.camera.getZoomPercent();
		}, 100);

		return () => {
			engine.stop();
			panZoom.detach();
			observer.disconnect();
			clearInterval(zoomInterval);
		};
	});
</script>

<div class="canvas-container" bind:this={containerEl}>
	<canvas bind:this={canvasEl}></canvas>
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
