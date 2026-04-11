<script lang="ts">
	import { projectState } from '$state/project.svelte';
	import { canvasState } from '$state/canvas.svelte';
	import { persistenceState } from '$state/persistence.svelte';
	import { getEngineRef } from '$canvas/engine-ref.js';


	let showSaved = $state(false);
	let fadeTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (persistenceState.lastSaved) {
			showSaved = true;
			if (fadeTimer) clearTimeout(fadeTimer);
			fadeTimer = setTimeout(() => {
				showSaved = false;
			}, 2000);
		}
	});

	function handleFit() {
		const engine = getEngineRef();
		if (!engine) return;

		// Collect all points: APs + floorplan corners
		const points = projectState.aps.map((ap) => ({ x: ap.x, y: ap.y }));

		// Include floorplan bounds if loaded
		const fp = engine.layers.find((l) => l.id === 'floorplan') as any;
		if (fp && fp.imageWidth > 0) {
			points.push({ x: 0, y: 0 });
			points.push({ x: fp.imageWidth, y: fp.imageHeight });
		}

		if (points.length === 0) return;

		const rect = engine.canvas.getBoundingClientRect();
		engine.camera.fitToBounds(points, rect.width, rect.height);
		engine.markDirty();
	}

	function handleReset() {
		const engine = getEngineRef();
		if (!engine) return;
		engine.camera.reset();
		engine.markDirty();
	}
</script>

<footer class="status-bar">
	<div class="status-left">
		<span class="status-item zoom"
			>{canvasState.zoom === 1 ? '100' : Math.round(canvasState.zoom * 100)}%</span
		>
		<button class="zoom-btn" onclick={handleFit} aria-label="Fit to view">Fit</button>
	</div>
	<div class="status-right">
		{#if showSaved}
			<span class="saved-indicator">Saved</span>
		{/if}
	</div>
</footer>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 24px;
		padding: 0 var(--space-3);
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-subtle);
	}

	.status-left {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.status-right {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 80px;
		justify-content: flex-end;
	}

	.status-item {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.zoom {
		font-family: var(--font-mono);
		min-width: 32px;
	}

	.zoom-btn {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		background: none;
		border: 1px solid var(--border-subtle);
		border-radius: 3px;
		padding: 0 4px;
		cursor: pointer;
		line-height: 16px;
		transition: all var(--transition-fast);
	}

	.zoom-btn:hover {
		color: var(--text-secondary);
		background: var(--bg-hover);
	}

.saved-indicator {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--color-success);
		opacity: 0.6;
	}
</style>
