<script lang="ts">
	import { appState } from '$state/app.svelte';
	import { projectState } from '$state/project.svelte';
	import type { Band } from '@deconflict/channels';
	import Icon from '$components/shared/Icon.svelte';
	import Select from '$components/shared/Select.svelte';
	import Dropdown from '$components/shared/Dropdown.svelte';
	import Tooltip from '$components/shared/Tooltip.svelte';
	import HelpDialog from '$components/dialogs/HelpDialog.svelte';
	import NewProjectDialog from '$components/dialogs/NewProjectDialog.svelte';
	import { downloadJson, importJson } from '$lib/export/json.js';
	import { exportPng } from '$lib/export/png.js';
	import { exportPdf } from '$lib/export/pdf.js';
	import { getEngineRef } from '$canvas/engine-ref.js';

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

		target.value = '';
	}

	async function handleExportPng() {
		const engine = getEngineRef();
		if (!engine) return;
		await exportPng(engine, { scale: 2, includeGrid: false });
	}

	async function handleExportPdf() {
		const engine = getEngineRef();
		if (!engine) return;
		await exportPdf(engine);
	}

	const fileMenuItems = [
		{ label: 'New Project', action: () => { newProjectOpen = true; }, shortcut: '' },
		{ label: 'Open Project...', action: handleOpenClick, shortcut: '' },
		{ label: 'Save Project', action: handleSaveProject, shortcut: '' },
		{ separator: true, label: '', action: () => {} },
		{ label: 'Export as PNG', action: handleExportPng, shortcut: '' },
		{ label: 'Export as PDF', action: handleExportPdf, shortcut: '' }
	];

	const bandOptions = [
		{ value: '2.4ghz', label: '2.4 GHz' },
		{ value: '5ghz', label: '5 GHz' },
		{ value: '6ghz', label: '6 GHz' }
	];
</script>

<header class="toolbar">
	<div class="toolbar-left">
		<span class="logo">Deconflict</span>

		<Dropdown items={fileMenuItems}>
			<Icon name="file" size={14} />
			<span class="dropdown-label">File</span>
		</Dropdown>

		<div class="band-select">
			<Select
				value={projectState.band}
				options={bandOptions}
				onchange={(val) => { projectState.band = val as Band; }}
				aria-label="WiFi band"
			/>
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

<input
	bind:this={fileInputEl}
	type="file"
	accept=".json,.deconflict.json"
	class="hidden-input"
	onchange={handleFileSelect}
/>
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
		gap: 4px;
	}

	.toolbar-right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
	}

	.logo {
		font-family: var(--font-mono);
		font-size: 13px;
		font-weight: 600;
		color: var(--accent-primary);
		user-select: none;
		margin-right: 8px;
	}

	.dropdown-label {
		font-size: var(--text-sm);
	}

	.band-select {
		margin-left: 4px;
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

</style>
