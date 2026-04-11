<script lang="ts">
	import { solverState, runSolver } from '$state/solver.svelte';
	import { appState } from '$state/app.svelte';
	import { projectState, clearAssignments } from '$state/project.svelte';
	import Button from '$components/shared/Button.svelte';
	import Toggle from '$components/shared/Toggle.svelte';
	import Select from '$components/shared/Select.svelte';
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
</script>

<div class="results-panel">
	<div class="section">
		<Button variant="primary" disabled={solverState.isRunning} onclick={() => runSolver()}>
			{solverState.isRunning ? 'Solving...' : 'Solve'}
		</Button>
		<Toggle
			bind:checked={solverState.autoSolve}
			label="Auto-solve on changes"
		/>
	</div>

	{#if solverState.error}
		<div class="section">
			<div class="error-msg">{solverState.error}</div>
		</div>
	{/if}

	{#if hasResult}
		<div class="section">
			<div class="quick-stats">
				<span class="stat">
					<span class="stat-value accent">{solverState.lastResult?.colorCount}</span> ch
				</span>
				<span class="stat-sep">/</span>
				<span class="stat">
					<span class="stat-value" class:conflict-zero={conflictCount === 0} class:conflict-bad={conflictCount > 0}>{conflictCount}</span> conflicts
				</span>
				<span class="stat-sep">/</span>
				<span class="stat">
					<span class="stat-value mono">{solverState.lastTiming.toFixed(1)}</span>ms
				</span>
			</div>
			<Button variant="ghost" onclick={handleClear}>
				Clear assignments
			</Button>
		</div>
	{:else}
		<div class="section">
			<p class="hint">Place APs and click Solve</p>
		</div>
	{/if}

	<div class="divider"></div>

	<div class="section">
		<div class="section-header">LAYERS</div>
		<Toggle bind:checked={appState.showHeatmap} label="Signal heatmap" />
		<Toggle bind:checked={appState.showFloorplan} label="Floorplan" />
		<Toggle bind:checked={appState.showAPs} label="Access points" />
		<Toggle bind:checked={appState.showRangeRings} label="Coverage rings" />
		<Toggle bind:checked={appState.showLabels} label="Labels" />
		<Toggle bind:checked={appState.showGrid} label="Grid" />
	</div>

	<div class="divider"></div>

	<div class="section">
		<div class="section-header">EXPORT</div>
		<div class="field-row">
			<span class="field-label">Resolution</span>
			<Select
				value={scale}
				options={scaleOptions}
				onchange={handleScaleChange}
				aria-label="Export resolution"
			/>
		</div>
		<Toggle bind:checked={includeGrid} label="Include grid" />
		<Button variant="primary" onclick={handleExportPng}>
			Export PNG
		</Button>
		<Button variant="primary" onclick={handleExportPdf}>
			Export PDF
		</Button>
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

	.quick-stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2);
		background: var(--bg-surface);
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.stat {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	.stat-sep {
		color: var(--text-tertiary);
	}

	.stat-value {
		font-family: var(--font-mono);
		font-weight: 600;
		color: var(--text-primary);
	}

	.stat-value.accent {
		color: var(--accent-primary);
	}

	.stat-value.mono {
		color: var(--text-secondary);
	}

	.conflict-zero {
		color: var(--color-success);
	}

	.conflict-bad {
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
</style>
