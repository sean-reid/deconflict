<script lang="ts">
	let {
		value = $bindable(''),
		options,
		onchange,
		class: className = '',
		'aria-label': ariaLabel = undefined
	}: {
		value?: string;
		options: Array<{ value: string; label: string }>;
		onchange?: (value: string) => void;
		class?: string;
		'aria-label'?: string;
	} = $props();

	function handleChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		value = target.value;
		onchange?.(value);
	}
</script>

<div class="select-wrapper {className}">
	<select
		{value}
		onchange={handleChange}
		aria-label={ariaLabel}
	>
		{#each options as opt}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
	<svg
		class="chevron"
		width="12"
		height="12"
		viewBox="0 0 16 16"
		fill="none"
		aria-hidden="true"
	>
		<path
			d="M4 6l4 4 4-4"
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
</div>

<style>
	.select-wrapper {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	select {
		appearance: none;
		background: var(--bg-surface);
		color: var(--text-primary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: var(--space-1) var(--space-6) var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		height: 28px;
		cursor: pointer;
		transition: border-color var(--transition-fast);
		line-height: 1;
	}

	select:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	select option {
		background: var(--bg-surface);
		color: var(--text-primary);
	}

	.chevron {
		position: absolute;
		right: var(--space-2);
		color: var(--text-tertiary);
		pointer-events: none;
	}
</style>
