<script lang="ts">
	import Button from '$components/shared/Button.svelte';
	import Select from '$components/shared/Select.svelte';
	import { projectState } from '$state/project.svelte';
	import { clearHistory } from '$state/history.svelte';
	import { clearSavedState } from '$state/persistence.svelte';
	import type { Band } from '@deconflict/channels';

	let {
		open = $bindable(false),
		onconfirm
	}: {
		open: boolean;
		onconfirm?: () => void;
	} = $props();

	let projectName = $state('Untitled Project');
	let band = $state<string>('5ghz');

	const bandOptions = [
		{ value: '2.4ghz', label: '2.4 GHz' },
		{ value: '5ghz', label: '5 GHz' },
		{ value: '6ghz', label: '6 GHz' }
	];

	function handleConfirm() {
		projectState.name = projectName;
		projectState.band = band as Band;
		projectState.channelWidth = 20;
		projectState.regulatoryDomain = 'fcc';
		projectState.aps = [];
		projectState.floorplanUrl = null;
		projectState.floorplanScale = 1;

		clearHistory();
		clearSavedState();

		open = false;
		onconfirm?.();
	}

	function handleCancel() {
		open = false;
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			open = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			open = false;
		}
	}

	$effect(() => {
		if (open) {
			projectName = 'Untitled Project';
			band = '5ghz';
		}
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_interactive_supports_focus -->
	<div
		class="overlay"
		role="dialog"
		aria-modal="true"
		aria-label="New Project"
		onclick={handleOverlayClick}
	>
		<div class="dialog">
			<h2 class="heading">New Project</h2>
			<p class="warning">This will clear the current layout.</p>

			<label class="field">
				<span class="field-label">Project name</span>
				<input
					type="text"
					class="field-input"
					bind:value={projectName}
					placeholder="Untitled Project"
				/>
			</label>

			<div class="field">
				<span class="field-label">Band</span>
				<Select
					value={band}
					options={bandOptions}
					onchange={(val) => { band = val; }}
				/>
			</div>

			<div class="actions">
				<Button variant="ghost" onclick={handleCancel}>Cancel</Button>
				<Button variant="primary" onclick={handleConfirm}>Create</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(var(--bg-primary-rgb, 10, 12, 16), 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.dialog {
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg, 8px);
		padding: var(--space-5, 20px);
		max-width: 400px;
		width: 90%;
		display: flex;
		flex-direction: column;
		gap: var(--space-3, 12px);
	}

	.heading {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--text-lg, 18px);
		font-weight: 600;
		color: var(--text-primary);
	}

	.warning {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1, 4px);
	}

	.field-label {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.field-input {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		height: 32px;
	}

	.field-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2, 8px);
		margin-top: var(--space-2, 8px);
	}
</style>
