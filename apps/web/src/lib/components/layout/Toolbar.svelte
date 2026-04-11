<script lang="ts">
	import { appState } from '$state/app.svelte';
	import type { Tool } from '$state/app.svelte';
	import { projectState } from '$state/project.svelte';
	import type { Band } from '@deconflict/channels';
	import { solverState, runSolver } from '$state/solver.svelte';
	import Icon from '$components/shared/Icon.svelte';
	import Button from '$components/shared/Button.svelte';
	import Select from '$components/shared/Select.svelte';
	import Tooltip from '$components/shared/Tooltip.svelte';
	import HelpDialog from '$components/dialogs/HelpDialog.svelte';

	let helpOpen = $state(false);

	const bandOptions = [
		{ value: '2.4ghz', label: '2.4 GHz' },
		{ value: '5ghz', label: '5 GHz' },
		{ value: '6ghz', label: '6 GHz' }
	];

	const tools: Array<{ id: Tool; icon: string; label: string }> = [
		{ id: 'select', icon: 'cursor', label: 'Select (V)' },
		{ id: 'place', icon: 'crosshair', label: 'Place AP (P)' },
		{ id: 'pan', icon: 'hand', label: 'Pan (H)' }
	];

	const viewToggles: Array<{
		key: 'showGrid' | 'showRangeRings' | 'showConflictEdges' | 'showLabels';
		icon: string;
		label: string;
	}> = [
		{ key: 'showGrid', icon: 'grid', label: 'Grid' },
		{ key: 'showRangeRings', icon: 'radio', label: 'Range rings' },
		{ key: 'showConflictEdges', icon: 'link', label: 'Conflict edges' },
		{ key: 'showLabels', icon: 'tag', label: 'Labels' }
	];
</script>

<header class="toolbar">
	<div class="toolbar-left">
		<span class="logo">Deconflict</span>

		<div class="separator"></div>

		<div class="tool-group">
			{#each tools as tool}
				<Tooltip text={tool.label} position="bottom">
					<button
						class="tool-btn"
						class:active={appState.activeTool === tool.id}
						onclick={() => { appState.activeTool = tool.id; }}
						aria-label={tool.label}
					>
						<Icon name={tool.icon} size={14} />
					</button>
				</Tooltip>
			{/each}
		</div>

		<div class="separator"></div>

		<Select
			value={projectState.band}
			options={bandOptions}
			onchange={(val) => { projectState.band = val as Band; }}
			aria-label="WiFi band"
		/>

		<div class="separator"></div>

		<Button variant="primary" size="sm" disabled={solverState.isRunning} onclick={() => runSolver()}>
			<Icon name="play" size={12} />
			{solverState.isRunning ? 'Solving...' : 'Solve'}
		</Button>

		<div class="separator"></div>

		<div class="view-toggles">
			{#each viewToggles as toggle}
				<Tooltip text={toggle.label} position="bottom">
					<button
						class="view-btn"
						class:active={appState[toggle.key]}
						onclick={() => { appState[toggle.key] = !appState[toggle.key]; }}
						aria-label={toggle.label}
					>
						<Icon name={toggle.icon} size={14} />
					</button>
				</Tooltip>
			{/each}
		</div>
	</div>

	<div class="toolbar-right">
		<Tooltip text="Help" position="bottom">
			<button
				class="tool-btn"
				onclick={() => { helpOpen = true; }}
				aria-label="Help"
			>
				<Icon name="help" size={14} />
			</button>
		</Tooltip>
		<Tooltip text="Toggle sidebar" position="bottom">
			<button
				class="tool-btn"
				class:active={appState.sidebarOpen}
				onclick={() => { appState.sidebarOpen = !appState.sidebarOpen; }}
				aria-label="Toggle sidebar"
			>
				<Icon name="sidebar" size={14} />
			</button>
		</Tooltip>
	</div>
</header>

<HelpDialog bind:open={helpOpen} />

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 40px;
		padding: 0 var(--space-3);
		background: var(--bg-secondary);
		border-bottom: 1px solid var(--border-subtle);
		z-index: var(--z-toolbar);
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.toolbar-right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.logo {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--accent-primary);
		user-select: none;
	}

	.separator {
		width: 1px;
		height: 20px;
		background: var(--border-subtle);
		margin: 0 var(--space-1);
		flex-shrink: 0;
	}

	.tool-group {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.tool-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.tool-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.tool-btn.active {
		background: var(--accent-primary-glow);
		color: var(--accent-primary);
		box-shadow: 0 0 8px var(--accent-primary-glow);
	}

	.tool-btn:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.view-toggles {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.view-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-tertiary);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.view-btn:hover {
		background: var(--bg-hover);
		color: var(--text-secondary);
	}

	.view-btn.active {
		color: var(--accent-primary);
	}

	.view-btn:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	@media (max-width: 768px) {
		.toolbar-left {
			overflow-x: auto;
			overflow-y: hidden;
			scrollbar-width: none;
		}

		.toolbar-left::-webkit-scrollbar {
			display: none;
		}

		.view-toggles {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.logo {
			display: none;
		}

		.separator:first-of-type {
			display: none;
		}
	}
</style>
