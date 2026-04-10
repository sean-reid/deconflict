<script lang="ts">
	import { projectState } from '$state/project.svelte';
	import { canvasState } from '$state/canvas.svelte';
	import { solverState } from '$state/solver.svelte';

	let apCount = $derived(projectState.aps.length);
	let apLabel = $derived(apCount === 1 ? '1 access point' : `${apCount} access points`);
</script>

<footer class="status-bar">
	<span class="status-item zoom">{canvasState.zoom === 1 ? '100' : Math.round(canvasState.zoom * 100)}%</span>
	<span class="status-item center">{apLabel}</span>
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
</style>
