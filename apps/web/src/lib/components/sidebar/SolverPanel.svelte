<script lang="ts">
	import { solverState, runSolver } from '$state/solver.svelte';
	import { clearAssignments } from '$state/project.svelte';
	import Select from '$components/shared/Select.svelte';
	import Button from '$components/shared/Button.svelte';
	import Toggle from '$components/shared/Toggle.svelte';
	import Tooltip from '$components/shared/Tooltip.svelte';

	const algorithmOptions = [
		{ value: 'greedy', label: 'Greedy' },
		{ value: 'dsatur', label: 'DSatur' },
		{ value: 'welsh-powell', label: 'Welsh-Powell' },
		{ value: 'backtracking', label: 'Backtracking' }
	];

	function handleAlgorithmChange(val: string) {
		solverState.algorithm = val as typeof solverState.algorithm;
	}

	async function handleSolve() {
		await runSolver();
	}

	function handleClear() {
		clearAssignments();
		solverState.lastResult = null;
		solverState.lastTiming = 0;
		solverState.error = null;
	}

	let hasResult = $derived(solverState.lastResult !== null);
	let conflictCount = $derived(solverState.lastResult?.conflicts.length ?? 0);

	let qualityLabel = $derived.by(() => {
		if (!solverState.lastResult) return '';
		const conflicts = solverState.lastResult.conflicts.length;
		if (conflicts === 0) return 'Excellent';
		if (conflicts <= 2) return 'Good';
		return 'Needs attention';
	});
</script>

<div class="solver-panel">
	<div class="section">
		<Tooltip text="The method used to assign channels. DSatur works well for most layouts. Backtracking finds the optimal solution but takes longer." position="left">
			<div class="section-header">ALGORITHM</div>
		</Tooltip>
		<Select
			value={solverState.algorithm}
			options={algorithmOptions}
			onchange={handleAlgorithmChange}
			class="full-width"
		/>
	</div>

	<div class="section">
		<Button
			variant="primary"
			disabled={solverState.isRunning}
			onclick={handleSolve}
		>
			{#if solverState.isRunning}
				<span class="spinner"></span>
				Solving...
			{:else}
				Solve
			{/if}
		</Button>
	</div>

	<div class="section">
		<Tooltip text="Automatically re-run the solver whenever you move or add access points." position="left">
			<Toggle
				bind:checked={solverState.autoSolve}
				label="Re-run when APs change"
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
	{/if}
</div>

<style>
	.solver-panel {
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

	:global(.full-width) {
		width: 100%;
	}

	:global(.full-width select) {
		width: 100%;
	}
</style>
