<script lang="ts">
	import { WALL_MATERIALS, type WallMaterialId } from '$canvas/materials.js';

	let {
		x,
		y,
		currentMaterial,
		onselect,
		onclose
	}: {
		x: number;
		y: number;
		currentMaterial: WallMaterialId;
		onselect: (id: WallMaterialId) => void;
		onclose: () => void;
	} = $props();

	function handleSelect(id: WallMaterialId) {
		onselect(id);
		onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="popup-backdrop" onclick={onclose}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="popup"
		style="left: {x}px; top: {y}px"
		onclick={(e) => e.stopPropagation()}
	>
		{#each WALL_MATERIALS as mat}
			<button
				class="material-row"
				class:active={mat.id === currentMaterial}
				onclick={() => handleSelect(mat.id)}
			>
				<span
					class="swatch"
					style="background: rgb({mat.color[0]},{mat.color[1]},{mat.color[2]})"
				></span>
				<span class="mat-name">{mat.name}</span>
				<span class="mat-db">{mat.attenuation} dB</span>
			</button>
		{/each}
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
		min-width: 150px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: var(--space-1);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.material-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border: none;
		background: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--text-primary);
		text-align: left;
		width: 100%;
	}

	.material-row:hover {
		background: var(--bg-hover);
	}

	.material-row.active {
		background: var(--accent-primary-glow);
	}

	.material-row:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.swatch {
		width: 12px;
		height: 12px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.mat-name {
		flex: 1;
	}

	.mat-db {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}
</style>
