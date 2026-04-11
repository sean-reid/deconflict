<script lang="ts">
	import { solverState } from '$state/solver.svelte';
	import { projectState, clearAssignments } from '$state/project.svelte';
	import Button from '$components/shared/Button.svelte';
	import Toggle from '$components/shared/Toggle.svelte';
	import Select from '$components/shared/Select.svelte';
	import Tooltip from '$components/shared/Tooltip.svelte';
	import { exportPng } from '$lib/export/png.js';
	import { exportPdf } from '$lib/export/pdf.js';
	import { getEngineRef } from '$canvas/engine-ref.js';

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

	function handleClear() {
		clearAssignments();
		solverState.lastResult = null;
		solverState.lastTiming = 0;
		solverState.error = null;
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

	let hasResult = $derived(solverState.lastResult !== null);
	let conflictCount = $derived(solverState.lastResult?.conflicts.length ?? 0);

	function getApName(id: string): string {
		return projectState.aps.find((a) => a.id === id)?.name ?? id;
	}

	let qualityLabel = $derived.by(() => {
		if (!solverState.lastResult) return '';
		const conflicts = solverState.lastResult.conflicts.length;
		if (conflicts === 0) return 'Excellent';
		if (conflicts <= 2) return 'Good';
		return 'Needs attention';
	});
</script>

<div class="results-panel">
	<div class="section">
		<Tooltip text="Automatically re-run the solver whenever you move or add access points." position="left">
			<Toggle
				bind:checked={solverState.autoSolve}
				label="Auto-solve on changes"
			/>
		</Tooltip>
	</div>

	{#if solverState.error}
		<div class="section">
			<div class="error-msg">{solverState.error}</div>
		</div>
	{/if}

	{#if hasResult}
		<div class="section">
			<div class="section-header">RESULTS</div>

			<div class="result-row">
				<Tooltip text="The number of different channels assigned. Fewer is better since it means less spectrum used." position="left">
					<span class="result-label">Colors used</span>
				</Tooltip>
				<span class="result-value accent">{solverState.lastResult?.colorCount}</span>
			</div>

			<div class="result-row">
				<Tooltip text="Pairs of nearby access points on the same channel. Zero is the goal." position="left">
					<span class="result-label">Conflicts</span>
				</Tooltip>
				<span class="result-value" class:conflict-zero={conflictCount === 0} class:conflict-bad={conflictCount > 0}>
					{conflictCount}
				</span>
			</div>

			<div class="result-row">
				<span class="result-label">Time</span>
				<span class="result-value mono">{solverState.lastTiming.toFixed(1)}ms</span>
			</div>

			<div class="result-row">
				<Tooltip text="Overall assessment of the channel plan based on the number of conflicts." position="left">
					<span class="result-label">Quality</span>
				</Tooltip>
				<span class="result-value" class:quality-excellent={qualityLabel === 'Excellent'} class:quality-good={qualityLabel === 'Good'} class:quality-bad={qualityLabel === 'Needs attention'}>
					{qualityLabel}
				</span>
			</div>
		</div>

		<div class="section">
			<Button variant="ghost" onclick={handleClear}>
				Clear Assignments
			</Button>
		</div>

		{#if solverState.throughputEstimates.length > 0}
			<div class="section">
				<div class="section-header">ESTIMATED THROUGHPUT</div>
				{#each solverState.throughputEstimates as est}
					<div class="throughput-row">
						<span class="throughput-name">{getApName(est.apId)}</span>
						<span class="throughput-value" class:below-target={!est.meetsTarget}>
							{est.cappedRate} Mbps
						</span>
					</div>
				{/each}
			</div>
		{/if}
	{:else}
		<div class="section">
			<p class="hint">Place APs and click Solve</p>
		</div>
	{/if}

	<div class="divider"></div>

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
	.results-panel {
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

	.hint {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		text-align: center;
		margin: var(--space-2) 0;
	}

	.divider {
		height: 1px;
		background: var(--border-subtle);
	}

	.error-msg {
		font-size: var(--text-sm);
		color: var(--color-error);
		background: var(--bg-surface);
		border: 1px solid var(--color-error-dim);
		border-radius: var(--radius-md);
		padding: var(--space-2);
	}

	.result-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-1) var(--space-2);
		background: var(--bg-surface);
		border-radius: var(--radius-md);
	}

	.result-label {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.result-value {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--text-primary);
	}

	.result-value.accent {
		color: var(--accent-primary);
	}

	.result-value.mono {
		color: var(--text-secondary);
	}

	.conflict-zero {
		color: var(--color-success);
	}

	.conflict-bad {
		color: var(--color-error);
	}

	.quality-excellent {
		color: var(--color-success);
	}

	.quality-good {
		color: var(--color-warning);
	}

	.quality-bad {
		color: var(--color-error);
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

	.description {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		margin: 0;
	}

	.throughput-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-1) var(--space-2);
		background: var(--bg-surface);
		border-radius: var(--radius-md);
	}

	.throughput-name {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.throughput-value {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--text-primary);
	}

	.throughput-value.below-target {
		color: var(--color-error);
	}
</style>
