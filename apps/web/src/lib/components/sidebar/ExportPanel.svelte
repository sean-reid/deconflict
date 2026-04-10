<script lang="ts">
	import Button from '$components/shared/Button.svelte';
	import Select from '$components/shared/Select.svelte';
	import Toggle from '$components/shared/Toggle.svelte';
	import { downloadJson, importJson } from '$lib/export/json.js';
	import { exportPng } from '$lib/export/png.js';
	import { exportPdf } from '$lib/export/pdf.js';
	import { getEngineRef } from '$canvas/engine-ref.js';

	let fileInputEl: HTMLInputElement;
	let importError = $state<string | null>(null);
	let scale = $state('2');
	let includeGrid = $state(false);

	const scaleOptions = [
		{ value: '1', label: '1x' },
		{ value: '2', label: '2x' },
		{ value: '4', label: '4x' }
	];

	function handleScaleChange(val: string) {
		scale = val;
	}

	function handleSaveProject() {
		downloadJson();
	}

	function handleLoadClick() {
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

	async function handleExportPng() {
		const engine = getEngineRef();
		if (!engine) return;
		await exportPng(engine, {
			scale: Number(scale),
			includeGrid
		});
	}

	async function handleExportPdf() {
		const engine = getEngineRef();
		if (!engine) return;
		await exportPdf(engine);
	}
</script>

<div class="export-panel">
	<div class="section">
		<div class="section-header">PROJECT FILE</div>
		<Button variant="secondary" onclick={handleSaveProject}>
			Save Project
		</Button>
		<Button variant="secondary" onclick={handleLoadClick}>
			Load Project
		</Button>
		<input
			bind:this={fileInputEl}
			type="file"
			accept=".json,.deconflict.json"
			class="hidden-input"
			onchange={handleFileSelect}
		/>
		{#if importError}
			<div class="error-msg">{importError}</div>
		{/if}
	</div>

	<div class="section">
		<div class="section-header">IMAGE EXPORT</div>
		<div class="field-row">
			<span class="field-label">Resolution</span>
			<Select
				value={scale}
				options={scaleOptions}
				onchange={handleScaleChange}
				aria-label="Export resolution"
			/>
		</div>
		<Toggle bind:checked={includeGrid} label="Include Grid" />
		<Button variant="primary" onclick={handleExportPng}>
			Export PNG
		</Button>
	</div>

	<div class="section">
		<div class="section-header">PDF REPORT</div>
		<Button variant="primary" onclick={handleExportPdf}>
			Generate Report
		</Button>
		<p class="description">Canvas snapshot with AP schedule table</p>
	</div>
</div>

<style>
	.export-panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.section-header {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 500;
	}

	.section :global(.btn) {
		width: 100%;
	}

	.field-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.field-label {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.error-msg {
		font-size: var(--text-sm);
		color: var(--color-error);
		background: var(--bg-surface);
		border: 1px solid var(--color-error-dim);
		border-radius: var(--radius-md);
		padding: var(--space-2);
	}

	.description {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		margin: 0;
	}

	.hidden-input {
		display: none;
	}
</style>
