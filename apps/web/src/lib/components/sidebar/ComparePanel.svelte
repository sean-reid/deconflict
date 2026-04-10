<script lang="ts">
	import { solverState, runComparison } from '$state/solver.svelte';
	import { clearAssignments, updateAp } from '$state/project.svelte';
	import Button from '$components/shared/Button.svelte';

	const algorithmNames: Record<string, string> = {
		greedy: 'Greedy',
		dsatur: 'DSatur',
		'welsh-powell': 'Welsh-Powell',
		backtracking: 'Backtracking'
	};

	async function handleCompare() {
		await runComparison();
	}

	function handleApplyBest() {
		const results = solverState.comparisonResults;
		if (!results || results.results.length === 0) return;
		const best = results.results[0]!;
		clearAssignments();
		for (const [apId, channel] of best.assignment) {
			updateAp(apId, { assignedChannel: channel });
		}
	}

	let hasResults = $derived(solverState.comparisonResults !== null && solverState.comparisonResults.results.length > 0);
	let results = $derived(solverState.comparisonResults?.results ?? []);
	let best = $derived(results.length > 0 ? results[0]! : null);
</script>

<div class="compare-panel">
	<div class="section">
		<div class="section-header">ALGORITHM COMPARISON</div>
		<Button
			variant="primary"
			disabled={solverState.isRunning}
			onclick={handleCompare}
		>
			{#if solverState.isRunning}
				<span class="spinner"></span>
				Comparing...
			{:else}
				Compare All
			{/if}
		</Button>
	</div>

	{#if solverState.error}
		<div class="section">
			<div class="error-msg">{solverState.error}</div>
		</div>
	{/if}

	{#if hasResults}
		<div class="section">
			<table class="results-table">
				<thead>
					<tr>
						<th class="col-algo">Algorithm</th>
						<th class="col-num">Colors</th>
						<th class="col-num">Conflicts</th>
						<th class="col-num">Time</th>
					</tr>
				</thead>
				<tbody>
					{#each results as row, i}
						<tr class="result-row">
							<td class="col-algo" class:best-algo={i === 0}>
								{algorithmNames[row.algorithm] ?? row.algorithm}
							</td>
							<td class="col-num mono">{row.colorCount}</td>
							<td class="col-num mono" class:conflict-zero={row.conflicts.length === 0} class:conflict-bad={row.conflicts.length > 0}>
								{row.conflicts.length}
							</td>
							<td class="col-num mono">{row.timeMs.toFixed(1)}ms</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="section">
			<Button variant="secondary" onclick={handleApplyBest}>
				Apply Best
			</Button>
		</div>

		{#if best}
			<div class="section">
				<p class="summary">
					Best: {algorithmNames[best.algorithm] ?? best.algorithm} with {best.colorCount} colors in {best.timeMs.toFixed(1)}ms
				</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.compare-panel {
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

	.error-msg {
		font-size: var(--text-sm);
		color: var(--color-error);
		background: var(--bg-surface);
		border: 1px solid var(--color-error-dim);
		border-radius: var(--radius-md);
		padding: var(--space-2);
	}

	.results-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-sm);
	}

	.results-table th {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 500;
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid var(--border-subtle);
	}

	.results-table td {
		padding: var(--space-1) var(--space-2);
		color: var(--text-primary);
	}

	.result-row {
		background: var(--bg-surface);
		border-bottom: 1px solid var(--border-subtle);
	}

	.result-row:last-child {
		border-bottom: none;
	}

	.col-algo {
		text-align: left;
	}

	.col-num {
		text-align: right;
	}

	.mono {
		font-family: var(--font-mono);
	}

	.best-algo {
		color: var(--color-success);
		font-weight: 600;
	}

	.conflict-zero {
		color: var(--color-success);
	}

	.conflict-bad {
		color: var(--color-error);
	}

	.summary {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		margin: 0;
	}

	.summary :global(strong) {
		color: var(--text-primary);
	}

	.spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid transparent;
		border-top-color: currentColor;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
