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

	let open = $state(false);
	let triggerEl = $state<HTMLButtonElement>();

	let selectedLabel = $derived(
		options.find((o) => o.value === value)?.label ?? options[0]?.label ?? ''
	);

	function toggle() {
		open = !open;
	}

	function select(val: string) {
		value = val;
		onchange?.(val);
		open = false;
		triggerEl?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			triggerEl?.focus();
		}
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

<div class="select-wrapper {className}">
	<button
		bind:this={triggerEl}
		class="trigger"
		type="button"
		onclick={toggle}
		aria-label={ariaLabel}
		aria-expanded={open}
		aria-haspopup="listbox"
	>
		<span class="trigger-label">{selectedLabel}</span>
		<svg class="chevron" class:open width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>

	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="backdrop" onclick={() => { open = false; }}></div>
		<div class="dropdown" role="listbox">
			{#each options as opt}
				<button
					class="option"
					class:selected={opt.value === value}
					role="option"
					aria-selected={opt.value === value}
					onclick={() => select(opt.value)}
				>
					{opt.label}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.select-wrapper {
		position: relative;
		display: inline-flex;
	}

	.trigger {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		background: var(--bg-surface);
		color: var(--text-primary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: var(--space-1) var(--space-2);
		padding-right: var(--space-5);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		height: 28px;
		cursor: pointer;
		transition: border-color var(--transition-fast);
		line-height: 1;
		white-space: nowrap;
		text-align: left;
	}

	.trigger:hover {
		border-color: var(--accent-primary-dim);
	}

	.trigger:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.chevron {
		position: absolute;
		right: var(--space-2);
		color: var(--text-tertiary);
		transition: transform var(--transition-fast);
	}

	.chevron.open {
		transform: rotate(180deg);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: var(--z-dropdown, 100);
	}

	.dropdown {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		min-width: 100%;
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.3));
		z-index: var(--z-dropdown, 100);
		padding: 2px;
		max-height: 200px;
		overflow-y: auto;
	}

	.option {
		display: block;
		width: 100%;
		padding: var(--space-1) var(--space-2);
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		text-align: left;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.option:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.option.selected {
		color: var(--accent-primary);
		font-weight: 500;
	}
</style>
