<script lang="ts">
	import { solverState, runSolver } from '$state/solver.svelte';
	import { clearAssignments } from '$state/project.svelte';
	import Select from '$components/shared/Select.svelte';
	import Button from '$components/shared/Button.svelte';
	import Toggle from '$components/shared/Toggle.svelte';

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
</script>

<div class="solver-panel">
	<div class="section">
		<div class="section-header">ALGORITHM</div>
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
		<Toggle
			bind:checked={solverState.autoSolve}
			label="Re-run when APs change"
		/>
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
				<span class="result-label">Colors used</span>
				<span class="result-value accent">{solverState.lastResult?.colorCount}</span>
			</div>

			<div class="result-row">
				<span class="result-label">Conflicts</span>
				<span class="result-value" class:conflict-zero={conflictCount === 0} class:conflict-bad={conflictCount > 0}>
					{conflictCount}
				</span>
			</div>

			<div class="result-row">
				<span class="result-label">Time</span>
				<span class="result-value mono">{solverState.lastTiming.toFixed(1)}ms</span>
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
