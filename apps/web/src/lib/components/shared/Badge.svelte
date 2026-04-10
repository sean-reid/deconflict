<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		color,
		children
	}: {
		color: string;
		children: Snippet;
	} = $props();
</script>

<span
	class="badge"
	style:background-color="{color}33"
	style:color={color}
>
	{@render children()}
</span>

<style>
	.badge {
		display: inline-flex;
		align-items: center;
		padding: 1px 6px;
		border-radius: 9999px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		line-height: 1.4;
		white-space: nowrap;
	}
</style>
