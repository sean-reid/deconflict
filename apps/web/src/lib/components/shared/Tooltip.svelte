<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		text,
		position = 'top',
		children
	}: {
		text: string;
		position?: 'top' | 'bottom' | 'left' | 'right';
		children: Snippet;
	} = $props();

	let visible = $state(false);
	let timeout: ReturnType<typeof setTimeout> | null = null;

	function show() {
		timeout = setTimeout(() => {
			visible = true;
		}, 400);
	}

	function hide() {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
		visible = false;
	}
</script>

<div
	class="tooltip-wrapper"
	role="group"
	onmouseenter={show}
	onmouseleave={hide}
	onfocusin={show}
	onfocusout={hide}
>
	{@render children()}
	{#if visible}
		<div class="tooltip tooltip-{position}" role="tooltip">
			{text}
		</div>
	{/if}
</div>

<style>
	.tooltip-wrapper {
		position: relative;
		display: inline-flex;
	}

	.tooltip {
		position: absolute;
		z-index: var(--z-tooltip);
		background: var(--bg-elevated);
		color: var(--text-secondary);
		font-size: var(--text-xs);
		line-height: 1.4;
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-md);
		white-space: normal;
		max-width: 220px;
		pointer-events: none;
	}

	.tooltip-top {
		bottom: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
	}

	.tooltip-bottom {
		top: calc(100% + 6px);
		left: 50%;
		transform: translateX(-50%);
	}

	.tooltip-left {
		right: calc(100% + 6px);
		top: 50%;
		transform: translateY(-50%);
	}

	.tooltip-right {
		left: calc(100% + 6px);
		top: 50%;
		transform: translateY(-50%);
	}
</style>
