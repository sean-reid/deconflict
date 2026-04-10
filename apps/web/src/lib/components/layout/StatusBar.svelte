<script lang="ts">
</script>

<footer class="status-bar">
	<span class="status-item zoom">100%</span>
	<span class="status-item center">0 access points</span>
	<span class="status-item right"></span>
</footer>

<style>
	.status-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 24px;
		padding: 0 var(--space-3);
		background: var(--bg-secondary);
		border-top: 1px solid var(--border-subtle);
	}

	.status-item {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.zoom {
		font-family: var(--font-mono);
	}

	.right {
		min-width: 60px;
	}
</style>
