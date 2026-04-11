<script lang="ts">
	import { appState } from '$state/app.svelte';
	import Icon from '$components/shared/Icon.svelte';

	let collapsed = $state(typeof window !== 'undefined' && window.innerWidth <= 768);

	const layers = [
		{ key: 'showHeatmap', label: 'Signal heatmap' },
		{ key: 'showFloorplan', label: 'Floorplan' },
		{ key: 'showAPs', label: 'Access points' },
		{ key: 'showWalls', label: 'Walls' },
		{ key: 'showLabels', label: 'Labels' },
		{ key: 'showGrid', label: 'Grid' }
	] as const;

	const legendItems = [
		{ color: 'rgb(40, 150, 40)', label: 'Excellent' },
		{ color: 'rgb(100, 180, 80)', label: 'Good' },
		{ color: 'rgb(210, 190, 30)', label: 'Fair' },
		{ color: 'rgb(220, 120, 20)', label: 'Poor' },
		{ color: 'rgb(180, 40, 40)', label: 'Dead' }
	];

	function toggleLayer(key: typeof layers[number]['key']) {
		appState[key] = !appState[key];
	}
</script>

<div class="layer-panel">
	<button class="panel-header" onclick={() => collapsed = !collapsed}>
		<span class="panel-title">Layers</span>
		<span class="collapse-icon" class:collapsed>
			<Icon name="chevron-down" size={12} />
		</span>
	</button>

	{#if !collapsed}
		<div class="panel-body">
			{#each layers as layer}
				<button
					class="layer-row"
					onclick={() => toggleLayer(layer.key)}
				>
					<span class="eye-icon" class:hidden={!appState[layer.key]}>
						<Icon name={appState[layer.key] ? 'eye' : 'eye-off'} size={14} />
					</span>
					<span class="layer-label">{layer.label}</span>
				</button>
			{/each}

			{#if appState.showHeatmap}
				<div class="legend-divider"></div>
				<div class="legend">
					{#each legendItems as item}
						<div class="legend-row">
							<span class="legend-swatch" style:background={item.color}></span>
							<span class="legend-label">{item.label}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.layer-panel {
		position: absolute;
		bottom: var(--space-3, 12px);
		left: var(--space-3, 12px);
		z-index: 5;
		min-width: 140px;
		max-height: calc(100% - 80px);
		overflow-y: auto;
		background: rgba(30, 33, 48, 0.92);
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-md);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-primary);
		user-select: none;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-2) var(--space-2);
		border: none;
		background: none;
		color: var(--text-secondary);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 500;
	}

	.panel-header:hover {
		color: var(--text-primary);
	}

	.collapse-icon {
		display: flex;
		align-items: center;
		transition: transform var(--transition-fast);
	}

	.collapse-icon.collapsed {
		transform: rotate(-90deg);
	}

	.panel-body {
		padding: 0 var(--space-2) var(--space-2);
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.layer-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		height: 22px;
		padding: 0 var(--space-1);
		border: none;
		background: none;
		color: var(--text-primary);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		border-radius: var(--radius-sm);
		width: 100%;
		text-align: left;
	}

	.layer-row:hover {
		background: var(--bg-hover);
	}

	.eye-icon {
		display: flex;
		align-items: center;
		color: var(--accent-primary);
		flex-shrink: 0;
	}

	.eye-icon.hidden {
		color: var(--text-disabled);
	}

	.layer-label {
		white-space: nowrap;
	}

	.legend-divider {
		height: 1px;
		background: var(--border-subtle);
		margin: var(--space-1) 0;
	}

	.legend {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 var(--space-1);
	}

	.legend-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		height: 18px;
	}

	.legend-swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.legend-label {
		color: var(--text-secondary);
		font-size: var(--text-xs);
	}
</style>
