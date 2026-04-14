<script lang="ts">
	import { floorState, switchFloor, addFloor } from '$state/floor-state.svelte';

	let hoveredId = $state<string | null>(null);

	function handleAdd() {
		const floor = addFloor();
		switchFloor(floor.id);
	}
</script>

{#if floorState.floors.length > 1}
	<div class="floor-dots">
		{#each [...floorState.floors].sort((a, b) => b.level - a.level) as floor}
			<button
				class="dot"
				class:active={floor.id === floorState.currentFloorId}
				onmouseenter={() => { hoveredId = floor.id; }}
				onmouseleave={() => { hoveredId = null; }}
				onclick={() => switchFloor(floor.id)}
				aria-label="Switch to {floor.name}"
			>
				{#if floor.id === floorState.currentFloorId || hoveredId === floor.id}
					<span class="dot-label">{floor.name}</span>
				{/if}
			</button>
		{/each}
		<button
			class="dot add"
			onclick={handleAdd}
			aria-label="Add floor"
		>
			<svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
			</svg>
		</button>
	</div>
{/if}

<style>
	.floor-dots {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		z-index: 15;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 8px;
	}

	.dot {
		position: relative;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 2px solid var(--text-tertiary);
		background: transparent;
		cursor: pointer;
		padding: 0;
		transition: all var(--transition-fast);
		display: flex;
		align-items: center;
	}

	.dot:hover {
		border-color: var(--text-secondary);
	}

	.dot.active {
		border-color: var(--accent-primary);
		background: var(--accent-primary);
		box-shadow: 0 0 6px var(--accent-primary-glow);
	}

	.dot-label {
		position: absolute;
		left: 20px;
		white-space: nowrap;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-primary);
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		padding: 2px 8px;
		pointer-events: none;
		box-shadow: var(--shadow-md, 0 2px 8px rgba(0, 0, 0, 0.3));
	}

	.dot.add {
		border-style: dashed;
		border-color: var(--border-subtle);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-tertiary);
	}

	.dot.add:hover {
		border-color: var(--accent-primary-dim);
		color: var(--accent-primary);
	}

	/* Mobile: bigger tap targets */
	@media (max-width: 768px) {
		.dot {
			width: 16px;
			height: 16px;
			/* 44px tap target via padding */
			padding: 14px;
			margin: -14px;
		}

		.dot.active .dot-label {
			display: block;
		}
	}
</style>
