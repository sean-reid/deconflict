<script lang="ts">
	import Button from '$components/shared/Button.svelte';

	let {
		open = $bindable(false),
		title = 'Confirm',
		message = 'Are you sure?',
		confirmLabel = 'Delete',
		confirmVariant = 'danger' as 'danger' | 'primary',
		onconfirm
	}: {
		open: boolean;
		title?: string;
		message?: string;
		confirmLabel?: string;
		confirmVariant?: 'danger' | 'primary';
		onconfirm?: () => void;
	} = $props();

	function handleConfirm() {
		open = false;
		onconfirm?.();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') open = false;
		if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) open = false;
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_interactive_supports_focus -->
	<div class="overlay" role="dialog" aria-modal="true" aria-label={title} onclick={handleOverlayClick}>
		<div class="dialog">
			<h2 class="heading">{title}</h2>
			<p class="message">{message}</p>
			<div class="actions">
				<Button variant="ghost" onclick={() => { open = false; }}>Cancel</Button>
				<Button variant={confirmVariant} onclick={handleConfirm}>{confirmLabel}</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(var(--bg-primary-rgb, 10, 12, 16), 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.dialog {
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg, 8px);
		padding: var(--space-5, 20px);
		max-width: 380px;
		width: 90%;
		display: flex;
		flex-direction: column;
		gap: var(--space-3, 12px);
	}

	.heading {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--text-lg, 18px);
		font-weight: 600;
		color: var(--text-primary);
	}

	.message {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		line-height: 1.5;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2, 8px);
		margin-top: var(--space-2, 8px);
	}
</style>
