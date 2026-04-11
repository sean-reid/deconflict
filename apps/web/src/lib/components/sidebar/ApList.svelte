<script lang="ts">
	import { projectState, removeAps } from '$state/project.svelte';
	import { canvasState, selectAp, selectAps, clearSelection } from '$state/canvas.svelte';
	import { channelColor } from '@deconflict/channels';
	import Button from '$components/shared/Button.svelte';
	import Icon from '$components/shared/Icon.svelte';

	const bandLabels: Record<string, string> = {
		'2.4ghz': '2.4G',
		'5ghz': '5G',
		'6ghz': '6G'
	};

	let hasSelection = $derived(canvasState.selectedApIds.length > 0);
	let selectionCount = $derived(canvasState.selectedApIds.length);

	function isSelected(id: string): boolean {
		return canvasState.selectedApIds.includes(id);
	}

	function handleRowClick(id: string, e: MouseEvent) {
		selectAp(id, e.shiftKey);
	}

	function selectAll() {
		selectAps(projectState.aps.map((ap) => ap.id));
	}

	function deleteSelected() {
		removeAps([...canvasState.selectedApIds]);
		clearSelection();
	}

	function clearAll() {
		removeAps(projectState.aps.map((ap) => ap.id));
		clearSelection();
	}
</script>

<div class="ap-list">
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
			<p class="empty-hint">Click the + button in the toolbar or press P to place your WiFi devices on the canvas</p>
		</div>
	{:else}
		<div class="list">
			{#each projectState.aps as ap (ap.id)}
				<button
					class="row"
					class:selected={isSelected(ap.id)}
					onclick={(e) => handleRowClick(ap.id, e)}
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
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.ap-list {
		display: flex;
		flex-direction: column;
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

	.count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		background: var(--bg-surface);
		border: 1px solid var(--border-subtle);
		border-radius: 9999px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-secondary);
		line-height: 1;
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
</style>
