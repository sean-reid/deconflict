<script lang="ts">
	import { appState } from '$state/app.svelte';
	import { WALL_MATERIALS, type WallMaterialId } from '$canvas/materials.js';
	import Icon from '$components/shared/Icon.svelte';

	let {
		activeMaterial = $bindable(0 as WallMaterialId),
		ondone
	}: {
		activeMaterial: WallMaterialId;
		ondone: () => void;
	} = $props();

	const mat = $derived(WALL_MATERIALS[activeMaterial] ?? WALL_MATERIALS[0]!);

	function setMode(mode: 'erase' | 'draw' | 'material') {
		appState.wallEditMode = mode;
		appState.wallEditLastMode = mode;
	}
</script>

<div class="wall-toolbar">
	<div class="row-top">
		<button
			class="tool"
			class:active={appState.wallEditMode === 'erase'}
			onclick={() => setMode('erase')}
		>
			<Icon name="eraser" size={14} />
			<span class="tool-label">Erase</span>
		</button>
		<button
			class="tool"
			class:active={appState.wallEditMode === 'draw'}
			onclick={() => setMode('draw')}
		>
			<Icon name="pencil" size={14} />
			<span class="tool-label">Draw</span>
		</button>
		<button
			class="tool"
			class:active={appState.wallEditMode === 'material'}
			onclick={() => setMode('material')}
		>
			<span class="mat-swatch" style="background: rgb({mat.color.join(',')})"></span>
			<span class="tool-label">Material</span>
		</button>

		<span class="separator"></span>

		<input
			type="range"
			min="3"
			max="40"
			bind:value={appState.wallBrushSize}
			class="brush-slider"
			aria-label="Brush size"
		/>

		<button class="done-btn" onclick={ondone}>Done</button>
	</div>

	{#if appState.wallEditMode === 'material' || appState.wallEditMode === 'draw'}
		<div class="row-bottom">
			{#each WALL_MATERIALS as m}
				<button
					class="mat-chip"
					class:active={activeMaterial === m.id}
					onclick={() => { activeMaterial = m.id; }}
				>
					<span class="chip-dot" style="background: rgb({m.color.join(',')})"></span>
					<span class="chip-name">{m.name}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.wall-toolbar {
		position: absolute;
		top: 8px;
		left: 8px;
		right: 8px;
		margin: 0 auto;
		width: fit-content;
		z-index: 20;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 6px 8px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		max-width: calc(100vw - 16px);
	}

	.row-top {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.row-bottom {
		display: flex;
		gap: 2px;
		flex-wrap: wrap;
	}

	.tool {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 8px;
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.tool:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.tool.active {
		background: var(--accent-primary-glow);
		color: var(--accent-primary);
	}

	.tool:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.mat-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.separator {
		width: 1px;
		height: 18px;
		background: var(--border-subtle);
		flex-shrink: 0;
	}

	.brush-slider {
		width: 50px;
		accent-color: var(--accent-primary);
		height: 4px;
	}

	.done-btn {
		padding: 4px 12px;
		border: none;
		border-radius: var(--radius-sm);
		background: var(--accent-primary);
		color: var(--text-on-accent, #fff);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}

	.done-btn:hover {
		opacity: 0.9;
	}

	/* Material chip row */
	.mat-chip {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 8px;
		border: 1px solid transparent;
		border-radius: 999px;
		background: var(--bg-surface);
		color: var(--text-tertiary);
		font-family: var(--font-sans);
		font-size: 10px;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
	}

	.mat-chip:hover {
		color: var(--text-primary);
		background: var(--bg-hover);
	}

	.mat-chip.active {
		border-color: var(--accent-primary);
		color: var(--text-primary);
		background: var(--accent-primary-glow);
	}

	.chip-dot {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	@media (max-width: 768px) {
		.tool-label {
			display: none;
		}

		/* Only show name on the active chip; others show just the dot */
		.mat-chip:not(.active) .chip-name {
			display: none;
		}

		.mat-chip:not(.active) {
			padding: 4px;
		}

		.mat-chip:not(.active) .chip-dot {
			width: 14px;
			height: 14px;
			border-radius: 3px;
		}

		.brush-slider {
			width: 40px;
		}
	}
</style>
