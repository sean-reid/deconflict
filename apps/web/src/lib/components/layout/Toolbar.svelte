<script lang="ts">
	import { appState } from '$state/app.svelte';
	import { projectState } from '$state/project.svelte';
	import type { Band } from '@deconflict/channels';
	import { solverState, runSolver } from '$state/solver.svelte';
	import Icon from '$components/shared/Icon.svelte';
	import Button from '$components/shared/Button.svelte';
	import Select from '$components/shared/Select.svelte';
	import Tooltip from '$components/shared/Tooltip.svelte';
	import HelpDialog from '$components/dialogs/HelpDialog.svelte';
	import NewProjectDialog from '$components/dialogs/NewProjectDialog.svelte';
	import { downloadJson, importJson } from '$lib/export/json.js';

	let helpOpen = $state(false);
	let newProjectOpen = $state(false);
	let fileInputEl: HTMLInputElement;
	let importError = $state<string | null>(null);

	function handleSaveProject() {
		downloadJson();
	}

	function handleOpenClick() {
		importError = null;
		fileInputEl.click();
	}

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		try {
			await importJson(file);
			importError = null;
		} catch (err) {
			importError = err instanceof Error ? err.message : 'Failed to import project';
		}

		// Reset input so the same file can be selected again
		target.value = '';
	}

	const bandOptions = [
		{ value: '2.4ghz', label: '2.4 GHz' },
		{ value: '5ghz', label: '5 GHz' },
		{ value: '6ghz', label: '6 GHz' }
	];

</script>

<header class="toolbar">
	<div class="toolbar-left">
		<span class="logo">Deconflict</span>

		<div class="separator"></div>

		<Tooltip text="New project" position="bottom">
			<button
				class="tool-btn"
				onclick={() => { newProjectOpen = true; }}
				aria-label="New project"
			>
				<Icon name="file" size={14} />
			</button>
		</Tooltip>

		<Tooltip text="Save project" position="bottom">
			<button
				class="tool-btn"
				onclick={handleSaveProject}
				aria-label="Save project"
			>
				<Icon name="download" size={14} />
			</button>
		</Tooltip>

		<Tooltip text="Open project" position="bottom">
			<button
				class="tool-btn"
				onclick={handleOpenClick}
				aria-label="Open project"
			>
				<Icon name="upload" size={14} />
			</button>
		</Tooltip>

		<input
			bind:this={fileInputEl}
			type="file"
			accept=".json,.deconflict.json"
			class="hidden-input"
			onchange={handleFileSelect}
		/>

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
			Solve
		</Button>

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
<NewProjectDialog bind:open={newProjectOpen} />

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

	.hidden-input {
		display: none;
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
