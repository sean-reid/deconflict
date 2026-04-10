<script lang="ts">
	let {
		value = $bindable(0),
		min = -Infinity,
		max = Infinity,
		step = 1,
		label = '',
		disabled = false
	}: {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		label?: string;
		disabled?: boolean;
	} = $props();

	function clamp(n: number): number {
		return Math.min(max, Math.max(min, n));
	}

	function decrement() {
		value = clamp(value - step);
	}

	function increment() {
		value = clamp(value + step);
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const parsed = Number(target.value);
		if (!Number.isNaN(parsed)) {
			value = clamp(parsed);
		}
	}
</script>

<div class="number-input">
	{#if label}
		<span class="label">{label}</span>
	{/if}
	<div class="controls">
		<button
			class="step-btn"
			{disabled}
			onclick={decrement}
			aria-label="Decrease"
		>
			<svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<path d="M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			</svg>
		</button>
		<input
			type="text"
			inputmode="numeric"
			value={value}
			{disabled}
			oninput={handleInput}
			onblur={handleInput}
		/>
		<button
			class="step-btn"
			{disabled}
			onclick={increment}
			aria-label="Increase"
		>
			<svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			</svg>
		</button>
	</div>
</div>

<style>
	.number-input {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.label {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 0;
	}

	.step-btn {
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		transition: background var(--transition-fast);
	}

	.step-btn:first-child {
		border-radius: var(--radius-sm) 0 0 var(--radius-sm);
		border-right: none;
	}

	.step-btn:last-child {
		border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
		border-left: none;
	}

	.step-btn:hover:not(:disabled) {
		background: var(--bg-hover);
	}

	.step-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input {
		width: 60px;
		height: 24px;
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: 0;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		text-align: center;
		padding: 0 var(--space-1);
		outline: none;
		transition: border-color var(--transition-fast);
	}

	input:focus {
		border-color: var(--accent-primary);
	}

	input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
