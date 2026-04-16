<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		x,
		y,
		maxY = typeof window !== 'undefined' ? window.innerHeight : 800,
		minWidth = 150,
		maxWidth = 220,
		onclose,
		children
	}: {
		x: number;
		y: number;
		maxY?: number;
		minWidth?: number;
		maxWidth?: number;
		onclose: () => void;
		children: Snippet;
	} = $props();

	let popupEl: HTMLDivElement;
	const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
	let posX = $state(Math.max(8, Math.min(x, vw - maxWidth - 8)));
	let posY = $state(y);
	let visible = $state(false);

	function adjustPosition() {
		if (!popupEl) return;
		const rect = popupEl.getBoundingClientRect();
		if (rect.right > vw - 8) posX = vw - rect.width - 8;
		if (posX < 8) posX = 8;
		if (rect.bottom > maxY) posY = Math.max(8, maxY - rect.height);
		visible = true;
	}

	// Render invisible first, measure, position, then show (no flicker)
	$effect(() => {
		if (!popupEl) return;
		requestAnimationFrame(adjustPosition);

		const observer = new MutationObserver(() => {
			requestAnimationFrame(adjustPosition);
		});
		observer.observe(popupEl, { childList: true, subtree: true, attributes: true });
		return () => observer.disconnect();
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="popup-backdrop" onclick={onclose} oncontextmenu={(e) => { e.preventDefault(); onclose(); }}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="popup"
		bind:this={popupEl}
		style="left: {posX}px; top: {posY}px; min-width: {minWidth}px; max-width: {maxWidth}px; visibility: {visible ? 'visible' : 'hidden'}"
		onclick={(e) => e.stopPropagation()}
	>
		{@render children()}
	</div>
</div>

<style>
	.popup-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
	}

	.popup {
		position: absolute;
		z-index: 51;
		max-height: 420px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: var(--space-1);
		display: flex;
		flex-direction: column;
		gap: 1px;
		overflow: hidden;
	}

	@media (max-width: 768px) {
		.popup {
			position: fixed;
			left: 0 !important;
			right: 0;
			bottom: 0;
			top: auto !important;
			max-width: 100% !important;
			max-height: 60vh;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		}
	}
</style>
