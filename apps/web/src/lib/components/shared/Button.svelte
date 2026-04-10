<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'secondary',
		size = 'md',
		disabled = false,
		onclick,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		disabled?: boolean;
		onclick?: (e: MouseEvent) => void;
		children: Snippet;
	} = $props();
</script>

<button
	class="btn btn-{variant} btn-{size}"
	{disabled}
	{onclick}
>
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
		line-height: 1;
	}

	.btn:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}

	/* Sizes */
	.btn-sm {
		height: 28px;
		padding: 0 10px;
		font-size: var(--text-sm);
	}

	.btn-md {
		height: 32px;
		padding: 0 14px;
		font-size: var(--text-base);
	}

	/* Variants */
	.btn-primary {
		background: var(--accent-primary);
		color: var(--bg-primary);
		border-color: var(--accent-primary);
	}

	.btn-primary:hover:not(:disabled) {
		background: color-mix(in srgb, var(--accent-primary) 85%, white);
		border-color: color-mix(in srgb, var(--accent-primary) 85%, white);
	}

	.btn-secondary {
		background: var(--bg-surface);
		color: var(--text-primary);
		border-color: var(--border-default);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--bg-hover);
	}

	.btn-ghost {
		background: transparent;
		color: var(--text-secondary);
	}

	.btn-ghost:hover:not(:disabled) {
		background: var(--bg-hover);
	}

	.btn-danger {
		background: var(--color-error-dim);
		color: #fff;
		border-color: var(--color-error-dim);
	}

	.btn-danger:hover:not(:disabled) {
		background: var(--color-error);
		border-color: var(--color-error);
	}
</style>
