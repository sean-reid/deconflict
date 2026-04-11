<script lang="ts">
	import { projectState } from '$state/project.svelte.js';
	import Button from '$components/shared/Button.svelte';
	import Icon from '$components/shared/Icon.svelte';

	let fileInput = $state<HTMLInputElement>();
	let dragOver = $state(false);

	let hasFloorplan = $derived(projectState.floorplanUrl !== null);

	const sampleFloorplans = [
		{ name: 'Small House', file: '/samples/little-white-house.svg' },
		{ name: 'State Floor', file: '/samples/state-floor.svg' },
		{ name: 'West Wing', file: '/samples/west-wing.svg' }
	];

	async function loadSample(url: string) {
		if (projectState.floorplanUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(projectState.floorplanUrl);
		}
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			projectState.floorplanUrl = URL.createObjectURL(blob);
		} catch {
			// Failed to load sample
		}
	}

	function handleFile(file: File) {
		const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
		if (!validTypes.includes(file.type)) return;
		if (projectState.floorplanUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(projectState.floorplanUrl);
		}
		projectState.floorplanUrl = URL.createObjectURL(file);
	}

	function handleInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
		input.value = '';
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function removeFloorplan() {
		if (projectState.floorplanUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(projectState.floorplanUrl);
		}
		projectState.floorplanUrl = null;
	}

	function handleOpacityChange(e: Event) {
		const input = e.target as HTMLInputElement;
		projectState.floorplanScale = parseFloat(input.value);
	}
</script>

<div class="floorplan-controls">
	{#if !hasFloorplan}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="drop-zone"
			class:drag-over={dragOver}
			ondrop={handleDrop}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
		>
			<Button variant="secondary" onclick={() => fileInput?.click()}>
				<Icon name="upload" size={14} />
				Import Floorplan
			</Button>
			<input
				bind:this={fileInput}
				type="file"
				accept=".png,.jpg,.jpeg,.svg"
				onchange={handleInputChange}
				hidden
			/>
		</div>
		<div class="samples">
			<span class="samples-label">or try a sample:</span>
			<div class="sample-buttons">
				{#each sampleFloorplans as sample}
					<button class="sample-btn" onclick={() => loadSample(sample.file)}>
						{sample.name}
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<div class="loaded-controls">
			<div class="loaded-header">
				<span class="loaded-label">
					<Icon name="file" size={14} />
					Floorplan loaded
				</span>
				<Button variant="ghost" size="sm" onclick={removeFloorplan}>
					<Icon name="trash" size={14} />
				</Button>
			</div>
			<div class="opacity-row">
				<label class="opacity-label" for="floorplan-opacity">Opacity</label>
				<input
					id="floorplan-opacity"
					type="range"
					min="0.1"
					max="1"
					step="0.1"
					value={projectState.floorplanScale}
					oninput={handleOpacityChange}
					class="opacity-slider"
				/>
				<span class="opacity-value">{Math.round(projectState.floorplanScale * 100)}%</span>
			</div>
		</div>
	{/if}
</div>

<style>
	.floorplan-controls {
		margin-bottom: var(--space-4);
		padding-bottom: var(--space-4);
		border-bottom: 1px solid var(--border-subtle);
	}

	.drop-zone {
		display: flex;
		width: 100%;
	}

	.drop-zone :global(.btn) {
		width: 100%;
	}

	.drop-zone.drag-over {
		outline: 2px dashed var(--accent-primary);
		outline-offset: 2px;
		border-radius: var(--radius-md);
	}

	.samples {
		margin-top: var(--space-2);
		text-align: center;
	}

	.samples-label {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.sample-buttons {
		display: flex;
		gap: var(--space-1);
		margin-top: var(--space-1);
		justify-content: center;
	}

	.sample-btn {
		font-size: var(--text-xs);
		color: var(--accent-primary);
		background: none;
		border: 1px solid var(--border-subtle);
		border-radius: var(--radius-sm);
		padding: 2px 8px;
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.sample-btn:hover {
		background: var(--bg-hover);
		border-color: var(--accent-primary-dim);
	}

	.loaded-controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.loaded-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.loaded-label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.opacity-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.opacity-label {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.opacity-slider {
		flex: 1;
		accent-color: var(--accent-primary);
		height: 4px;
	}

	.opacity-value {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		min-width: 36px;
		text-align: right;
	}
</style>
