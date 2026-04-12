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

	function setMode(mode: 'erase' | 'draw' | 'material') {
		appState.wallEditMode = mode;
		appState.wallEditLastMode = mode;
	}
</script>

<div class="wall-toolbar">
	<div class="tool-group">
		<button
			class="tool"
			class:active={appState.wallEditMode === 'erase'}
			onclick={() => setMode('erase')}
			aria-label="Eraser"
		>
			<Icon name="eraser" size={14} />
			<span>Erase</span>
		</button>
		<button
			class="tool"
			class:active={appState.wallEditMode === 'draw'}
			onclick={() => setMode('draw')}
			aria-label="Draw walls"
		>
			<Icon name="pencil" size={14} />
			<span>Draw</span>
		</button>
		<button
			class="tool"
			class:active={appState.wallEditMode === 'material'}
			onclick={() => setMode('material')}
			aria-label="Paint material"
		>
			<span
				class="mat-swatch"
				style="background: rgb({WALL_MATERIALS[activeMaterial]?.color.join(',') ?? '200,200,210'})"
			></span>
			<span>Material</span>
		</button>
	</div>

	{#if appState.wallEditMode === 'material'}
		<div class="mat-picker">
			{#each WALL_MATERIALS as mat}
				<button
					class="mat-option"
					class:active={activeMaterial === mat.id}
					onclick={() => { activeMaterial = mat.id; }}
					title="{mat.name} ({mat.attenuation} dB)"
				>
					<span class="mat-dot" style="background: rgb({mat.color.join(',')})"></span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="brush-group">
		<span class="brush-label">Size</span>
		<input
			type="range"
			min="3"
			max="40"
			bind:value={appState.wallBrushSize}
			class="brush-slider"
		/>
	</div>

	<button class="done-btn" onclick={ondone}>Done</button>
</div>

<style>
	.wall-toolbar {
		position: absolute;
		top: 8px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
	}

	.tool-group {
		display: flex;
		gap: 2px;
	}

	.tool {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: var(--space-1) var(--space-2);
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		cursor: pointer;
		transition: all var(--transition-fast);
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
	}

	.mat-picker {
		display: flex;
		gap: 2px;
		padding: 0 var(--space-1);
		border-left: 1px solid var(--border-subtle);
	}

	.mat-option {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.mat-option:hover {
		background: var(--bg-hover);
	}

	.mat-option.active {
		border-color: var(--accent-primary);
	}

	.mat-dot {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.brush-group {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: 0 var(--space-1);
		border-left: 1px solid var(--border-subtle);
	}

	.brush-label {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.brush-slider {
		width: 60px;
		accent-color: var(--accent-primary);
		height: 4px;
	}

	.done-btn {
		padding: var(--space-1) var(--space-3);
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

	.done-btn:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}
</style>
