<script lang="ts">
	import { appState } from '$state/app.svelte';
	import type { SidebarPanel } from '$state/app.svelte';
	import { canvasState } from '$state/canvas.svelte';
	import ApList from '$components/sidebar/ApList.svelte';
	import ApEditor from '$components/sidebar/ApEditor.svelte';
	import SolverPanel from '$components/sidebar/SolverPanel.svelte';
	import FloorplanControls from '$components/sidebar/FloorplanControls.svelte';
	import ExportPanel from '$components/sidebar/ExportPanel.svelte';

	const tabs: Array<{ id: SidebarPanel; label: string }> = [
		{ id: 'aps', label: 'APs' },
		{ id: 'solver', label: 'Solver' },
		{ id: 'export', label: 'Export' }
	];

	let hasSelection = $derived(canvasState.selectedApIds.length > 0);
</script>

{#if appState.sidebarOpen}
	<aside class="sidebar" aria-label="Sidebar">
		<div class="tab-bar" role="tablist">
			{#each tabs as tab}
				<button
					class="tab"
					class:active={appState.sidebarPanel === tab.id}
					role="tab"
					aria-selected={appState.sidebarPanel === tab.id}
					onclick={() => { appState.sidebarPanel = tab.id; }}
				>
					{tab.label}
				</button>
			{/each}
		</div>
		<div class="panel-content">
			{#if appState.sidebarPanel === 'aps'}
				<FloorplanControls />
				<ApList />
				{#if hasSelection}
					<ApEditor />
				{/if}
			{:else if appState.sidebarPanel === 'solver'}
				<SolverPanel />
			{:else if appState.sidebarPanel === 'export'}
				<ExportPanel />
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

</style>
