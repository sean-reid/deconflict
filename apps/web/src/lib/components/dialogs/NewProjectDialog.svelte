<script lang="ts">
	import Button from '$components/shared/Button.svelte';
	import { projectState } from '$state/project.svelte';
	import { clearHistory } from '$state/history.svelte';
	import { clearSavedState } from '$state/persistence.svelte';
	import { floorState } from '$state/floor-state.svelte';

	let {
		open = $bindable(false),
		onconfirm
	}: {
		open: boolean;
		onconfirm?: () => void;
	} = $props();

	let projectName = $state('Untitled Project');

	function handleConfirm() {
		if (projectState.floorplanUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(projectState.floorplanUrl);
		}
		projectState.name = projectName;
		projectState.band = '5ghz';
		projectState.channelWidth = 20;
		projectState.regulatoryDomain = 'fcc';
		projectState.aps = [];
		projectState.floorplanUrl = null;
		projectState.floorplanScale = 0.4;
		projectState.wallMask = null;
		projectState.wallMaterial = 0;
		projectState.materialMask = null;
		projectState.calibration = null;
		projectState.floorplanBoundary = null;
		projectState.ispSpeed = 0;
		projectState.targetThroughput = 25;

		// Reset floor state to a single default floor
		const newFloorId = crypto.randomUUID();
		floorState.floors = [{
			id: newFloorId,
			name: 'Floor 1',
			level: 0,
			ceilingHeight: 3.0,
			floorThickness: 0.2,
			floorMaterial: 1,
			floorplanUrl: null,
			floorplanScale: 0.4,
			calibration: null,
			floorplanBoundary: null,
			wallMask: null,
			wallAttenuation: 5,
			wallMaterial: 0,
			materialMask: null
		}];
		floorState.currentFloorId = newFloorId;

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
		} else if (e.key === 'Enter') {
			e.preventDefault();
			handleConfirm();
		}
	}

	$effect(() => {
		if (open) {
			projectName = 'Untitled Project';
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
		<form class="dialog" onsubmit={(e) => { e.preventDefault(); handleConfirm(); }}>
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

			<div class="actions">
				<Button variant="ghost" onclick={handleCancel}>Cancel</Button>
				<button class="submit-btn" type="submit">Create</button>
			</div>
		</form>
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

	.submit-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 32px;
		padding: 0 14px;
		background: var(--accent-primary);
		color: var(--bg-primary);
		border: 1px solid var(--accent-primary);
		border-radius: var(--radius-md);
		font-family: var(--font-sans);
		font-size: var(--text-base);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--transition-fast);
		white-space: nowrap;
		line-height: 1;
	}

	.submit-btn:hover {
		background: color-mix(in srgb, var(--accent-primary) 85%, white);
		border-color: color-mix(in srgb, var(--accent-primary) 85%, white);
	}

	.submit-btn:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}
</style>
