<script lang="ts">
	import { projectState } from '$state/project.svelte';
	import { canvasState, selectAp } from '$state/canvas.svelte';
	import { channelColor } from '@deconflict/channels';

	const bandLabels: Record<string, string> = {
		'2.4ghz': '2.4G',
		'5ghz': '5G',
		'6ghz': '6G'
	};

	function isSelected(id: string): boolean {
		return canvasState.selectedApIds.includes(id);
	}

	function handleRowClick(id: string, e: MouseEvent) {
		selectAp(id, e.shiftKey);
	}
</script>

<div class="ap-list">
	<div class="header">
		<span class="header-label">ACCESS POINTS</span>
		<span class="count">{projectState.aps.length}</span>
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
