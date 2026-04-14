<script lang="ts">
	import { onMount } from 'svelte';

	interface MenuItem {
		label: string;
		action: () => void;
		shortcut?: string;
		separator?: boolean;
		disabled?: boolean;
	}

	let { items, children }: { items: MenuItem[]; children: any } = $props();
	let open = $state(false);
	let highlighted = $state(-1);
	let menuEl: HTMLDivElement;
	let triggerEl: HTMLButtonElement;
	let menuStyle = $state('');

	const actionableItems = $derived(items.filter((i) => !i.separator && !i.disabled));

	function toggle() {
		open = !open;
		highlighted = -1;
		if (open && triggerEl) {
			const rect = triggerEl.getBoundingClientRect();
			menuStyle = `top: ${rect.bottom + 4}px; left: ${rect.left}px;`;
		}
	}

	function handleClick(item: MenuItem) {
		if (item.disabled) return;
		item.action();
		open = false;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!open) {
			if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				toggle();
			}
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlighted = (highlighted + 1) % actionableItems.length;
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlighted = highlighted <= 0 ? actionableItems.length - 1 : highlighted - 1;
		} else if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (highlighted >= 0 && highlighted < actionableItems.length) {
				handleClick(actionableItems[highlighted]!);
			}
		} else if (e.key === 'Escape') {
			e.preventDefault();
			open = false;
			triggerEl?.focus();
		}
	}

	function handleClickOutside(e: MouseEvent) {
		if (menuEl && !menuEl.contains(e.target as Node)) {
			open = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<svelte:window onkeydown={handleKeyDown} />
<div class="dropdown" bind:this={menuEl}>
	<button class="dropdown-trigger" bind:this={triggerEl} onclick={toggle} class:open>
		{@render children()}
		<svg
			class="trigger-chevron"
			width="10"
			height="10"
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
	</button>
	{#if open}
		<div class="dropdown-menu" style={menuStyle}>
			{#each items as item, idx}
				{#if item.separator}
					<div class="dropdown-separator"></div>
				{:else}
					<button
						class="dropdown-item"
						class:disabled={item.disabled}
						class:highlighted={highlighted >= 0 && actionableItems[highlighted] === item}
						onclick={() => handleClick(item)}
					>
						<span class="item-label">{item.label}</span>
						{#if item.shortcut}
							<span class="item-shortcut">{item.shortcut}</span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.dropdown {
		position: relative;
		display: inline-flex;
	}

	.dropdown-trigger {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.dropdown-trigger:hover,
	.dropdown-trigger.open {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.dropdown-trigger:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.trigger-chevron {
		opacity: 0.5;
		transition: transform var(--transition-fast);
	}

	.dropdown-trigger.open .trigger-chevron {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: fixed;
		min-width: 200px;
		background: var(--bg-elevated);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg, 8px);
		box-shadow: var(--shadow-lg);
		padding: 4px 0;
		z-index: var(--z-tooltip);
		animation: dropdown-fade-in 120ms ease-out;
	}

	@keyframes dropdown-fade-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 32px;
		padding: 0 12px;
		border: none;
		background: transparent;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: background var(--transition-fast);
		text-align: left;
	}

	.dropdown-item:hover,
	.dropdown-item.highlighted {
		background: var(--bg-hover);
	}

	.dropdown-item:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: -2px;
	}

	.dropdown-item.disabled {
		opacity: 0.4;
		cursor: default;
		pointer-events: none;
	}

	.item-label {
		flex: 1;
	}

	.item-shortcut {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		margin-left: 16px;
	}

	.dropdown-separator {
		height: 1px;
		background: var(--border-subtle);
		margin: 4px 8px;
	}
</style>
