<script lang="ts">
	import { WALL_MATERIALS, type WallMaterialId } from '$canvas/materials.js';
	import CanvasPopup from './CanvasPopup.svelte';

	let {
		x,
		y,
		maxY,
		currentMaterial,
		onselect,
		onclose
	}: {
		x: number;
		y: number;
		maxY?: number;
		currentMaterial: WallMaterialId;
		onselect: (id: WallMaterialId) => void;
		onclose: () => void;
	} = $props();

	function handleSelect(id: WallMaterialId) {
		onselect(id);
		onclose();
	}
</script>

<CanvasPopup {x} {y} {maxY} {onclose} minWidth={150} maxWidth={180}>
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
</CanvasPopup>

<style>
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
