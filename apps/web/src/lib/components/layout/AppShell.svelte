<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '$state/app.svelte';
	import Toolbar from './Toolbar.svelte';
	import Sidebar from './Sidebar.svelte';
	import StatusBar from './StatusBar.svelte';
	import CanvasView from '$components/canvas/CanvasView.svelte';

	onMount(() => {
		if (window.innerWidth <= 768) {
			appState.sidebarOpen = false;
		}
	});
</script>

<div class="app-shell">
	<div class="toolbar-row">
		<Toolbar />
	</div>
	<div class="canvas-area">
		<CanvasView />
	</div>
	{#if appState.sidebarOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="sidebar-backdrop" role="presentation" onclick={() => { appState.sidebarOpen = false; }}></div>
		<div class="sidebar-area">
			<Sidebar />
		</div>
	{/if}
	<div class="statusbar-row">
		<StatusBar />
	</div>
</div>

<style>
	.app-shell {
		display: grid;
		grid-template-rows: 40px 1fr 24px;
		grid-template-columns: 1fr auto;
		width: 100vw;
		height: 100vh;
		background: var(--bg-primary);
		overflow: hidden;
	}

	.toolbar-row {
		grid-column: 1 / -1;
		grid-row: 1;
	}

	.canvas-area {
		grid-column: 1;
		grid-row: 2;
		overflow: hidden;
		position: relative;
	}

	.sidebar-area {
		grid-column: 2;
		grid-row: 2;
		width: 320px;
		border-left: 1px solid var(--border-subtle);
	}

	.statusbar-row {
		grid-column: 1 / -1;
		grid-row: 3;
	}

	.sidebar-backdrop {
		display: none;
	}

	@media (max-width: 768px) {
		.app-shell {
			grid-template-columns: 1fr;
		}

		.sidebar-backdrop {
			display: block;
			position: fixed;
			inset: 0;
			background: rgba(0, 0, 0, 0.4);
			z-index: calc(var(--z-sidebar) - 1);
		}

		.sidebar-area {
			position: absolute;
			top: 40px;
			right: 0;
			bottom: 24px;
			width: 100%;
			max-width: 320px;
			z-index: var(--z-sidebar);
			border-left: 1px solid var(--border-subtle);
			background: var(--bg-secondary);
		}
	}
</style>
