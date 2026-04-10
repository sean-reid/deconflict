<script lang="ts">
	import { appState } from '$state/app.svelte';
	import type { SidebarPanel } from '$state/app.svelte';
	import { canvasState } from '$state/canvas.svelte';
	import ApList from '$components/sidebar/ApList.svelte';
	import ApEditor from '$components/sidebar/ApEditor.svelte';

	const tabs: Array<{ id: SidebarPanel; label: string }> = [
		{ id: 'aps', label: 'APs' },
		{ id: 'solver', label: 'Solver' },
		{ id: 'compare', label: 'Compare' },
		{ id: 'export', label: 'Export' }
	];

	let hasSelection = $derived(canvasState.selectedApIds.length > 0);
</script>

{#if appState.sidebarOpen}
	<aside class="sidebar">
		<nav class="tab-bar">
			{#each tabs as tab}
				<button
					class="tab"
					class:active={appState.sidebarPanel === tab.id}
					onclick={() => { appState.sidebarPanel = tab.id; }}
				>
					{tab.label}
				</button>
			{/each}
		</nav>
		<div class="panel-content">
			{#if appState.sidebarPanel === 'aps'}
				<ApList />
				{#if hasSelection}
					<ApEditor />
				{/if}
			{:else}
				<p class="placeholder">{appState.sidebarPanel} panel</p>
			{/if}
		</div>
	</aside>
{/if}

<style>
	.sidebar {
		width: 320px;
		display: flex;
		flex-direction: column;
		background: var(--bg-secondary);
		border-left: 1px solid var(--border-subtle);
		z-index: var(--z-sidebar);
		overflow: hidden;
	}

	.tab-bar {
		display: flex;
		padding: 0 var(--space-2);
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	.tab {
		flex: 1;
		padding: var(--space-2) var(--space-2);
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-tertiary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
		text-align: center;
	}

	.tab:hover {
		color: var(--text-secondary);
	}

	.tab.active {
		color: var(--text-primary);
		border-bottom-color: var(--accent-primary);
	}

	.tab:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: -2px;
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-4);
	}

	.placeholder {
		color: var(--text-tertiary);
		font-size: var(--text-sm);
		text-transform: capitalize;
	}
</style>
