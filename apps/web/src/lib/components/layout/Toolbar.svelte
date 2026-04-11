<script lang="ts">
	import { appState } from '$state/app.svelte';
	import { projectState } from '$state/project.svelte';
	import { scheduleSave } from '$state/persistence.svelte';
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
	let editingName = $state(false);
	let nameInputEl = $state<HTMLInputElement>();

	function startRename() {
		editingName = true;
		// Focus after Svelte renders the input
		setTimeout(() => {
			nameInputEl?.select();
			nameInputEl?.focus();
		}, 0);
	}

	function commitRename() {
		const trimmed = projectState.name.trim();
		if (!trimmed) projectState.name = 'Untitled Project';
		editingName = false;
		scheduleSave();
	}

	function handleNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') commitRename();
		if (e.key === 'Escape') {
			editingName = false;
		}
	}

	async function handleSaveProject() {
		await downloadJson();
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

		<span class="separator">/</span>

		{#if editingName}
			<input
				bind:this={nameInputEl}
				class="project-name-input"
				type="text"
				bind:value={projectState.name}
				onblur={commitRename}
				onkeydown={handleNameKeydown}
			/>
		{:else}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<span
				class="project-name"
				ondblclick={startRename}
				title="Double-click to rename"
			>{projectState.name}</span>
		{/if}

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

		<Tooltip text="Toggle between imperial (ft) and metric (m) units" position="bottom">
			<button
				class="unit-btn"
				onclick={() => {
					projectState.unitSystem = projectState.unitSystem === 'imperial' ? 'metric' : 'imperial';
					scheduleSave();
				}}
				aria-label="Toggle units"
			>
				{projectState.unitSystem === 'imperial' ? 'ft' : 'm'}
			</button>
		</Tooltip>
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
	}

	.separator {
		color: var(--text-disabled);
		font-size: 13px;
		margin: 0 4px;
		user-select: none;
	}

	.project-name {
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--text-secondary);
		cursor: default;
		max-width: 180px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		padding: 2px 4px;
		border-radius: var(--radius-sm);
		margin-right: 4px;
	}

	.project-name:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.project-name-input {
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--text-primary);
		background: var(--bg-surface);
		border: 1px solid var(--accent-primary);
		border-radius: var(--radius-sm);
		padding: 2px 6px;
		height: 24px;
		width: 160px;
		outline: none;
		margin-right: 4px;
	}

	.dropdown-label {
		font-size: var(--text-sm);
	}

	.band-select {
		margin-left: 4px;
	}

	.unit-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 6px;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		background: var(--bg-surface);
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: all var(--transition-fast);
		margin-left: 4px;
	}

	.unit-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
		border-color: var(--accent-primary-dim);
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

		.logo,
		.separator {
			display: none;
		}

		.project-name {
			max-width: 120px;
			font-size: 12px;
		}

		.project-name-input {
			width: 120px;
			font-size: 12px;
		}
	}

</style>
