<script lang="ts">
	import { projectState, removeAps } from '$state/project.svelte';
	import { canvasState, selectAp, selectAps, clearSelection } from '$state/canvas.svelte';
	import { solverState } from '$state/solver.svelte';
	import { optimizerState, runOptimizer, cancelOptimizer } from '$state/optimizer.svelte';
	import { channelColor } from '@deconflict/channels';
	import { floorState, switchFloor, getFloor } from '$state/floor-state.svelte.js';
	import Button from '$components/shared/Button.svelte';
	import Icon from '$components/shared/Icon.svelte';
	import ConfirmDialog from '$components/dialogs/ConfirmDialog.svelte';

	let confirmOpen = $state(false);
	let confirmMessage = $state('');
	let confirmAction = $state<(() => void) | null>(null);

	function showConfirm(message: string, action: () => void) {
		confirmMessage = message;
		confirmAction = action;
		confirmOpen = true;
	}

	const bandLabels: Record<string, string> = {
		'2.4ghz': '2.4G',
		'5ghz': '5G',
		'6ghz': '6G'
	};

	let throughputMap = $derived(
		new Map(solverState.throughputEstimates.map((e) => [e.apId, e]))
	);

	let hasSelection = $derived(canvasState.selectedApIds.length > 0);
	let selectionCount = $derived(canvasState.selectedApIds.length);

	function isSelected(id: string): boolean {
		return canvasState.selectedApIds.includes(id);
	}

	let apsByFloor = $derived.by(() => {
		const groups: Array<{ floor: { id: string; name: string }; aps: typeof projectState.aps }> = [];
		for (const floor of floorState.floors) {
			const aps = projectState.aps.filter((ap) => ap.floorId === floor.id);
			if (aps.length > 0) groups.push({ floor: { id: floor.id, name: floor.name }, aps });
		}
		// Add any APs with orphaned floorIds
		const knownFloorIds = new Set(floorState.floors.map((f) => f.id));
		const orphans = projectState.aps.filter((ap) => !knownFloorIds.has(ap.floorId));
		if (orphans.length > 0) groups.push({ floor: { id: '', name: 'Unknown Floor' }, aps: orphans });
		return groups;
	});

	let multiFloor = $derived(floorState.floors.length > 1);

	function handleRowClick(id: string, floorId: string, e: MouseEvent) {
		// Switch to the AP's floor if different
		if (floorId && floorId !== floorState.currentFloorId) {
			switchFloor(floorId);
		}
		selectAp(id, e.shiftKey);
	}

	function selectAll() {
		selectAps(projectState.aps.map((ap) => ap.id));
	}

	function deleteSelected() {
		showConfirm('Delete selected access points?', () => {
			removeAps([...canvasState.selectedApIds]);
			clearSelection();
		});
	}

	function clearAll() {
		showConfirm('Delete all access points on this floor?', () => {
			removeAps(projectState.aps.map((ap) => ap.id));
			clearSelection();
		});
	}
</script>

<div class="ap-list">
	<div class="ap-list-scroll">
	<div class="header">
		<span class="header-label">ACCESS POINTS</span>
		<div class="header-actions">
			{#if hasSelection}
				<button class="action-btn delete" onclick={deleteSelected} aria-label="Delete selected">
					<Icon name="trash" size={12} />
					{selectionCount}
				</button>
			{/if}
			{#if projectState.aps.length > 0}
				<button class="action-btn" onclick={selectAll} aria-label="Select all">
					All
				</button>
				<button class="action-btn delete" onclick={clearAll} aria-label="Clear all access points">
					Clear
				</button>
			{/if}
		</div>
	</div>

	{#if projectState.aps.length === 0}
		<div class="empty-state">
			<p class="empty-text">No access points yet</p>
			<p class="empty-hint">Click the canvas to place access points</p>
		</div>
	{:else}
		<div class="list">
			{#each apsByFloor as group}
				{#if multiFloor}
					<div class="floor-group-header" class:active-floor={group.floor.id === floorState.currentFloorId}>
						{group.floor.name}
						<span class="floor-group-count">{group.aps.length}</span>
					</div>
				{/if}
				{#each group.aps as ap (ap.id)}
				<button
					class="row"
					class:selected={isSelected(ap.id)}
					class:other-floor={multiFloor && ap.floorId !== floorState.currentFloorId}
					onclick={(e) => handleRowClick(ap.id, ap.floorId, e)}
				>
					<span
						class="dot"
						style:background-color={ap.assignedChannel
							? channelColor(ap.assignedChannel, ap.band)
							: 'var(--text-tertiary)'}
					></span>
					<span class="name">{ap.name}</span>
					<span class="band">{bandLabels[ap.band] ?? ap.band}</span>
					<span class="channel" class:unassigned={!ap.assignedChannel}>
						{#if ap.assignedChannel}
							<span
								class="channel-dot"
								style:background-color={channelColor(ap.assignedChannel, ap.band)}
							></span>
							{ap.assignedChannel}
						{:else}
							Pending
						{/if}
					</span>
					{#if throughputMap.has(ap.id)}
						<span class="throughput" class:below-target={!throughputMap.get(ap.id)?.meetsTarget}>
							{throughputMap.get(ap.id)?.cappedRate}Mbps
						</span>
					{/if}
				</button>
			{/each}
			{/each}
		</div>
	{/if}

	</div>
	{#if projectState.aps.length >= 1 && projectState.wallMask}
		<div class="coverage-section">
			{#if optimizerState.coverage > 0}
				<div class="coverage-bar-container">
					<div class="coverage-bar-label">
						<span>Coverage</span>
						<span class="coverage-value">{optimizerState.coverage}%</span>
					</div>
					<div class="coverage-bar-track">
						<div
							class="coverage-bar-fill"
							class:low={optimizerState.coverage < 30}
							class:med={optimizerState.coverage >= 30 && optimizerState.coverage < 60}
							class:high={optimizerState.coverage >= 60}
							style="width: {optimizerState.coverage}%"
						></div>
					</div>
				</div>
			{/if}

			{#if optimizerState.isRunning}
				<div class="optimize-progress">
					<span class="optimize-status">Optimizing... {optimizerState.progress}%</span>
					<button class="action-btn" onclick={cancelOptimizer}>Cancel</button>
				</div>
			{:else}
				<Button variant="secondary" size="sm" onclick={runOptimizer}>
					<Icon name="sparkles" size={14} />
					Optimize Placement
				</Button>
				{#if optimizerState.error}
					<span class="optimize-error">{optimizerState.error}</span>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<ConfirmDialog
	bind:open={confirmOpen}
	title="Delete"
	message={confirmMessage}
	confirmLabel="Delete"
	onconfirm={() => { confirmAction?.(); }}
/>

<style>
	.ap-list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.ap-list-scroll {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
		padding: var(--space-4) var(--space-4) 0;
	}

	.floor-group-header {
		padding: 4px 8px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-tertiary);
		letter-spacing: 0.05em;
		text-transform: uppercase;
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.floor-group-header.active-floor {
		color: var(--accent-primary);
	}

	.floor-group-count {
		font-weight: 400;
		opacity: 0.6;
	}

	.row.other-floor {
		opacity: 0.5;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0 var(--space-2) 0;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: var(--text-xs);
		font-family: var(--font-sans);
		color: var(--text-tertiary);
		background: none;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 2px 6px;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.action-btn:hover {
		background: var(--bg-hover);
		color: var(--text-secondary);
	}

	.action-btn:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.action-btn.delete {
		color: var(--color-error-dim);
		border-color: var(--color-error-dim);
	}

	.action-btn.delete:hover {
		background: rgba(255, 68, 68, 0.1);
		color: var(--color-error);
	}

	.header-label {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 500;
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 1px;
		overflow-y: auto;
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-2);
		background: none;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: background var(--transition-fast);
		text-align: left;
		width: 100%;
	}

	.row:hover {
		background: var(--bg-hover);
	}

	.row.selected {
		background: var(--accent-primary-glow);
	}

	.row:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: -2px;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.name {
		flex: 1;
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.band {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.channel {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--text-primary);
		flex-shrink: 0;
		min-width: 32px;
		text-align: right;
	}

	.channel.unassigned {
		color: var(--text-disabled);
		font-style: italic;
	}

	.channel-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		margin-right: 2px;
		vertical-align: middle;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-8) var(--space-4);
		text-align: center;
	}

	.empty-text {
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		margin: 0 0 var(--space-1) 0;
	}

	.empty-hint {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-disabled);
		margin: 0;
	}

	.throughput {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		flex-shrink: 0;
		min-width: 48px;
		text-align: right;
	}

	.throughput.below-target {
		color: var(--color-error);
	}

	.coverage-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4) var(--space-4);
		border-top: 1px solid var(--border-subtle);
		flex-shrink: 0;
	}

	.coverage-section :global(.btn) {
		width: 100%;
	}

	.coverage-bar-container {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.coverage-bar-label {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.coverage-value {
		font-family: var(--font-mono);
		color: var(--text-secondary);
	}

	.coverage-bar-track {
		height: 6px;
		background: var(--bg-surface);
		border-radius: 3px;
		overflow: hidden;
	}

	.coverage-bar-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.coverage-bar-fill.low {
		background: var(--color-error, #ff4444);
	}

	.coverage-bar-fill.med {
		background: var(--color-warning, #ffb800);
	}

	.coverage-bar-fill.high {
		background: var(--color-success, #4ade80);
	}

	.optimize-progress {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.optimize-status {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		font-style: italic;
	}

	.optimize-error {
		font-size: var(--text-xs);
		color: var(--color-error);
	}
</style>
