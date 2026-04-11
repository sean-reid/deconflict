<script lang="ts">
	import { projectState } from '$state/project.svelte';
	import { canvasState } from '$state/canvas.svelte';
	import { solverState } from '$state/solver.svelte';
	import { persistenceState } from '$state/persistence.svelte';
	import { getEngineRef } from '$canvas/engine-ref.js';

	let apCount = $derived(projectState.aps.length);
	let apLabel = $derived(apCount === 1 ? '1 access point' : `${apCount} access points`);
	let conflictCount = $derived(solverState.lastResult?.conflicts.length ?? 0);
	let hasSolved = $derived(solverState.lastResult !== null);

	let centerMessage = $derived.by(() => {
		if (apCount === 0) return { text: 'Add access points to get started', style: 'neutral' };
		if (!hasSolved)
			return { text: `${apLabel} - click Solve to assign channels`, style: 'neutral' };
		if (conflictCount === 0) return { text: `${apLabel} - all channels clear`, style: 'success' };
		const conflictLabel = conflictCount === 1 ? '1 conflict' : `${conflictCount} conflicts`;
		return { text: `${apLabel} - ${conflictLabel} detected`, style: 'warning' };
	});

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
	<span
		class="status-item center"
		class:status-success={centerMessage.style === 'success'}
		class:status-warning={centerMessage.style === 'warning'}>{centerMessage.text}</span
	>
	<div class="status-right">
		{#if showSaved}
			<span class="saved-indicator">Saved</span>
		{/if}
		<span class="status-item mono">
			{#if solverState.lastResult}
				{solverState.lastTiming.toFixed(1)}ms
			{/if}
		</span>
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
		font-size: 10px;
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

	.reset-btn {
		color: var(--color-error-dim);
		border-color: var(--color-error-dim);
	}

	.reset-btn:hover {
		color: var(--color-error);
		background: rgba(255, 68, 68, 0.1);
	}

	.mono {
		font-family: var(--font-mono);
	}

	.status-success {
		color: var(--color-success);
	}

	.status-warning {
		color: var(--color-error);
	}

	.saved-indicator {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--color-success);
		opacity: 0.6;
	}
</style>
