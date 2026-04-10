<script lang="ts">
	let {
		checked = $bindable(false),
		label = '',
		disabled = false
	}: {
		checked?: boolean;
		label?: string;
		disabled?: boolean;
	} = $props();
</script>

<label class="toggle" class:disabled>
	<button
		role="switch"
		aria-checked={checked}
		aria-label={label || 'Toggle'}
		{disabled}
		class="track"
		class:on={checked}
		onclick={() => { checked = !checked; }}
	>
		<span class="thumb"></span>
	</button>
	{#if label}
		<span class="label">{label}</span>
	{/if}
</label>

<style>
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
	}

	.toggle.disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.track {
		position: relative;
		width: 32px;
		height: 18px;
		background: var(--border-strong);
		border: none;
		border-radius: 9px;
		cursor: pointer;
		transition: background var(--transition-fast);
		padding: 0;
		flex-shrink: 0;
	}

	.track:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.track.on {
		background: var(--accent-primary);
	}

	.thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 14px;
		height: 14px;
		background: var(--text-primary);
		border-radius: 50%;
		transition: transform var(--transition-fast);
	}

	.track.on .thumb {
		transform: translateX(14px);
	}

	.label {
		color: var(--text-secondary);
		font-size: var(--text-sm);
		user-select: none;
	}
</style>
