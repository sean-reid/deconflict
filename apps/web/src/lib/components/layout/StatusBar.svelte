<script lang="ts">
	import { projectState } from '$state/project.svelte';
	import { canvasState } from '$state/canvas.svelte';
	import { solverState } from '$state/solver.svelte';
	import { persistenceState } from '$state/persistence.svelte';

	let apCount = $derived(projectState.aps.length);
	let apLabel = $derived(apCount === 1 ? '1 access point' : `${apCount} access points`);
	let showSaved = $state(false);
	let fadeTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (persistenceState.lastSaved) {
			showSaved = true;
			if (fadeTimer) clearTimeout(fadeTimer);
			fadeTimer = setTimeout(() => { showSaved = false; }, 2000);
		}
	});
</script>

<footer class="status-bar">
	<span class="status-item zoom">{canvasState.zoom === 1 ? '100' : Math.round(canvasState.zoom * 100)}%</span>
	<span class="status-item center">{apLabel}</span>
	{#if showSaved}
		<span class="saved-indicator">Saved</span>
	{/if}
	<span class="status-item right mono">
		{#if solverState.lastResult}
			{solverState.lastTiming.toFixed(1)}ms
		{/if}
	</span>
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

	.status-item {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.zoom {
		font-family: var(--font-mono);
	}

	.right {
		min-width: 60px;
		text-align: right;
	}

	.mono {
		font-family: var(--font-mono);
	}

	.saved-indicator {
		font-size: var(--text-xs);
		font-family: var(--font-mono);
		color: var(--color-success);
		opacity: 0.6;
	}
</style>
