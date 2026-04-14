<script lang="ts">
	import { wallState } from '$state/wall-state.svelte.js';
	import { floorplanState } from '$state/floorplan-state.svelte.js';
	import { apState } from '$state/ap-state.svelte.js';
	import { floorState, switchFloor, addFloor, removeFloor, currentFloor } from '$state/floor-state.svelte.js';
	import { FLOOR_MATERIALS } from '$canvas/floor-materials.js';
	import Select from '$components/shared/Select.svelte';
	import ConfirmDialog from '$components/dialogs/ConfirmDialog.svelte';

	let confirmOpen = $state(false);
	let confirmMessage = $state('');
	let confirmAction = $state<(() => void) | null>(null);

	function showConfirm(message: string, action: () => void) {
		confirmMessage = message;
		confirmAction = action;
		confirmOpen = true;
	}

	let editingFloorId = $state<string | null>(null);
	let editingFloorName = $state('');

	function handleAddFloor() {
		pushState();
		const floor = addFloor();
		switchFloor(floor.id);
		scheduleSave();
	}

	function startRenameFloor(id: string, name: string) {
		editingFloorId = id;
		editingFloorName = name;
	}

	function commitRenameFloor() {
		if (editingFloorId) {
			const floor = floorState.floors.find((f) => f.id === editingFloorId);
			if (floor) {
				floor.name = editingFloorName.trim() || floor.name;
				scheduleSave();
			}
		}
		editingFloorId = null;
	}

	function moveFloor(id: string, direction: -1 | 1) {
		const idx = floorState.floors.findIndex((f) => f.id === id);
		const newIdx = idx + direction;
		if (newIdx < 0 || newIdx >= floorState.floors.length) return;
		// Swap levels
		const a = floorState.floors[idx]!;
		const b = floorState.floors[newIdx]!;
		const tmpLevel = a.level;
		a.level = b.level;
		b.level = tmpLevel;
		// Swap positions in array
		floorState.floors[idx] = b;
		floorState.floors[newIdx] = a;
		floorState.floors = [...floorState.floors]; // trigger reactivity
		scheduleSave();
	}

	function handleDeleteFloor(id: string) {
		if (floorState.floors.length <= 1) return;
		showConfirm('Delete this floor and all its access points?', () => {
			pushState();
			apState.aps = apState.aps.filter((ap) => ap.floorId !== id);
			removeFloor(id);
			scheduleSave();
		});
	}
	import { appState } from '$state/app.svelte.js';
	import { detectBoundary, prepareSvgForDetection, polygonArea } from '$canvas/boundary-detect.js';
	import { detectWalls, encodeMask } from '$canvas/wall-detect.js';
	import { scheduleSave } from '$state/persistence.svelte.js';
	import { pushState } from '$state/history.svelte.js';
	import Button from '$components/shared/Button.svelte';
	import Icon from '$components/shared/Icon.svelte';

	const FLOORPLAN_TARGET_WIDTH = 800;


	let fileInput = $state<HTMLInputElement>();
	let dragOver = $state(false);
	let detecting = $state(false);
	let areaInput = $state('');
	let areaUnit = $state<'sqm' | 'sqft'>(floorplanState.unitSystem === 'imperial' ? 'sqft' : 'sqm');
	let detectedWorldArea = $state<number | null>(null);
	let calibrationDone = $state(false);

	let hasFloorplan = $derived(floorplanState.floorplanUrl !== null || wallState.wallMask !== null);

	const sampleFloorplans = [
		{ name: 'Apartment (48sqm)', file: '/samples/apartment-48sqm.svg', areaSqm: 48 },
		{ name: 'House (120sqm)', file: '/samples/house-120sqm.svg', areaSqm: 120 },
		{ name: 'Office (300sqm)', file: '/samples/office-300sqm.svg', areaSqm: 300 },
		{ name: 'West Wing (14000sqft)', file: '/samples/west-wing.svg', areaSqm: 1300 }
	];

	let scaleDisplay = $derived.by(() => {
		if (!floorplanState.calibration) return null;
		const mPerPx = 1 / floorplanState.calibration.worldUnitsPerMeter;
		if (floorplanState.unitSystem === 'imperial') {
			return `1px = ${(mPerPx * 3.28084).toFixed(2)}ft`;
		}
		return `1px = ${mPerPx.toFixed(2)}m`;
	});

	async function runBoundaryDetection(url: string, isSvg = false) {
		detecting = true;
		calibrationDone = false;
		detectedWorldArea = null;
		areaInput = '';
		floorplanState.calibration = null;
		floorplanState.floorplanBoundary = null;

		try {
			// Load the original image (same one FloorplanLayer renders)
			const originalImg = await new Promise<HTMLImageElement>((resolve, reject) => {
				const i = new Image();
				i.onload = () => resolve(i);
				i.onerror = reject;
				i.src = url;
			});
			const scaleFactor = FLOORPLAN_TARGET_WIDTH / originalImg.naturalWidth;

			// For SVGs, strip text for cleaner boundary detection
			const cleanImg = await prepareSvgForDetection(url);

			// Boundary detection for area calculation
			const result = detectBoundary(cleanImg);
			if (result && result.polygon.length >= 3) {
				const cleanScaleFactor = FLOORPLAN_TARGET_WIDTH / cleanImg.naturalWidth;
				const worldPolygon = result.polygon.map((p) => ({
					x: p.x * cleanScaleFactor,
					y: p.y * cleanScaleFactor
				}));
				floorplanState.floorplanBoundary = worldPolygon;

				// Use the actual pixel area from boundary detection, scaled to world coords.
				// Morphological close ensures door gaps don't leak flood fill but area
				// isn't inflated by the dilation step.
				detectedWorldArea = result.areaPx * cleanScaleFactor * cleanScaleFactor;
			}

			// Run OCR on all images - SVGs may have path-based text that prepareSvgForDetection can't strip
			const wallMask = await detectWalls(cleanImg, FLOORPLAN_TARGET_WIDTH);
			if (wallMask) {
				wallState.wallMask = wallMask;
				scheduleSave();
			}
		} catch (e) {
			console.warn('Detection failed:', e);
		}
		detecting = false;
	}

	function applyCalibration() {
		const val = parseFloat(areaInput);
		if (!val || val <= 0) return;

		// Use detected area if available, otherwise compute from wall mask bounding box
		let worldArea = detectedWorldArea;
		if (!worldArea && wallState.wallMask) {
			const { width, height } = wallState.wallMask;
			// Use the mask dimensions as the world area (pixels squared)
			worldArea = width * height;
		}
		if (!worldArea) return;

		let realAreaSqm = val;
		if (areaUnit === 'sqft') {
			realAreaSqm = val * 0.092903;
		}
		const worldUnitsPerMeter = Math.sqrt(worldArea / realAreaSqm);
		const oldCalibration = floorplanState.calibration;
		floorplanState.calibration = { worldUnitsPerMeter };

		if (oldCalibration === null) {
			// First calibration: set uncalibrated APs (radius=150) to real 15m
			const defaultRadiusWorld = Math.round(15 * worldUnitsPerMeter);
			for (const ap of apState.aps) {
				if (ap.interferenceRadius === 150) {
					ap.interferenceRadius = defaultRadiusWorld;
				}
			}
		} else {
			// Recalibration: scale all AP radii proportionally to preserve real-world meters
			const ratio = worldUnitsPerMeter / oldCalibration.worldUnitsPerMeter;
			for (const ap of apState.aps) {
				ap.interferenceRadius = Math.round(ap.interferenceRadius * ratio);
			}
		}

		calibrationDone = true;
		scheduleSave();
	}

	function skipCalibration() {
		floorplanState.floorplanBoundary = null;
		detectedWorldArea = null;
		calibrationDone = true;
	}

	function handleAreaKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			applyCalibration();
		}
	}

	async function loadSample(url: string, knownAreaSqm?: number) {
		if (floorplanState.floorplanUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(floorplanState.floorplanUrl);
		}
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);
			floorplanState.floorplanUrl = blobUrl;
			await runBoundaryDetection(blobUrl, url.endsWith('.svg'));

			// Auto-calibrate if we know the area
			if (knownAreaSqm && detectedWorldArea && detectedWorldArea > 0) {
				areaInput = String(knownAreaSqm);
				areaUnit = 'sqm';
				applyCalibration();
			}
		} catch {
			// Failed to load sample
		}
	}

	function handleFile(file: File) {
		const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
		if (!validTypes.includes(file.type)) return;
		if (floorplanState.floorplanUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(floorplanState.floorplanUrl);
		}
		const blobUrl = URL.createObjectURL(file);
		floorplanState.floorplanUrl = blobUrl;
		runBoundaryDetection(blobUrl, file.type === 'image/svg+xml');
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
		showConfirm('Remove floorplan and all APs on this floor?', doRemoveFloorplan);
	}

	function doRemoveFloorplan() {
		pushState();
		if (floorplanState.floorplanUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(floorplanState.floorplanUrl);
		}
		floorplanState.floorplanUrl = null;
		floorplanState.floorplanBoundary = null;
		floorplanState.calibration = null;
		wallState.wallMask = null;
		wallState.wallMaterial = 0;
		wallState.materialMask = null;
		apState.aps = apState.aps.filter((ap) => ap.floorId !== floorState.currentFloorId);
		detectedWorldArea = null;
		calibrationDone = false;
		areaInput = '';
		scheduleSave();
	}

	function handleOpacityChange(e: Event) {
		const input = e.target as HTMLInputElement;
		floorplanState.floorplanScale = parseFloat(input.value);
	}
</script>

<div class="floorplan-controls">
	<div class="floor-manager">
		<div class="floor-strip">
			{#each floorState.floors as floor}
				{#if editingFloorId === floor.id}
					<input
						class="floor-name-input"
						type="text"
						bind:value={editingFloorName}
						onblur={commitRenameFloor}
						onkeydown={(e) => { if (e.key === 'Enter') commitRenameFloor(); if (e.key === 'Escape') { editingFloorId = null; } }}
						autofocus
					/>
				{:else}
					<button
						class="floor-pill"
						class:active={floor.id === floorState.currentFloorId}
						onclick={() => switchFloor(floor.id)}
						ondblclick={() => startRenameFloor(floor.id, floor.name)}
						title="Click to switch, double-click to rename"
					>
						{floor.name}
						{#if floor.id === floorState.currentFloorId && floorState.floors.length > 1}
							{#if floorState.floors.indexOf(floor) > 0}
								<span class="floor-action" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); moveFloor(floor.id, -1); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); moveFloor(floor.id, -1); } }}>&#9664;</span>
							{/if}
							{#if floorState.floors.indexOf(floor) < floorState.floors.length - 1}
								<span class="floor-action" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); moveFloor(floor.id, 1); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); moveFloor(floor.id, 1); } }}>&#9654;</span>
							{/if}
							<span class="floor-action delete" role="button" tabindex="0" onclick={(e) => { e.stopPropagation(); handleDeleteFloor(floor.id); }} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleDeleteFloor(floor.id); } }}>&times;</span>
						{/if}
					</button>
				{/if}
			{/each}
			<button class="floor-pill add" onclick={handleAddFloor} aria-label="Add floor">+</button>
		</div>
	</div>
	{#if floorState.floors.length > 1}
		<div class="floor-props">
			<div class="prop-row">
				<span class="prop-label">Ceiling height</span>
				<input
					type="number"
					class="prop-input"
					value={currentFloor().ceilingHeight}
					min="2" max="10" step="0.5"
					onchange={(e) => { pushState(); currentFloor().ceilingHeight = Number((e.target as HTMLInputElement).value); scheduleSave(); }}
				/>
				<span class="prop-unit">m</span>
			</div>
			<div class="prop-row">
				<span class="prop-label">Floor thickness</span>
				<input
					type="number"
					class="prop-input"
					value={currentFloor().floorThickness}
					min="0.05" max="1" step="0.05"
					onchange={(e) => { pushState(); currentFloor().floorThickness = Number((e.target as HTMLInputElement).value); scheduleSave(); }}
				/>
				<span class="prop-unit">m</span>
			</div>
			<div class="prop-row">
				<span class="prop-label">Floor material</span>
				<Select
					value={String(currentFloor().floorMaterial)}
					options={FLOOR_MATERIALS.map(m => ({ value: String(m.id), label: m.name }))}
					onchange={(v) => { pushState(); currentFloor().floorMaterial = Number(v) as any; scheduleSave(); }}
				/>
			</div>
		</div>
	{/if}

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
					<button class="sample-btn" onclick={() => loadSample(sample.file, sample.areaSqm)}>
						{sample.name}
					</button>
				{/each}
			</div>
		</div>
		<div class="draw-scratch">
			<Button variant="secondary" size="sm" onclick={() => {
				pushState();
				const w = 2000;
				const h = 1500;
				const emptyData = new Uint8Array(w * h);
				const dataUrl = encodeMask(emptyData, w, h);
				wallState.wallMask = { dataUrl, width: w, height: h, originX: 0, originY: 0 };
				appState.wallEditMode = 'draw';
				scheduleSave();
			}}>
				<Icon name="pencil" size={14} />
				Draw from Scratch
			</Button>
		</div>
	{:else}
		<div class="loaded-controls">
			<div class="loaded-header">
				<span class="loaded-label">
					<Icon name="file" size={14} />
					{floorplanState.floorplanUrl ? 'Floorplan loaded' : 'Walls drawn'}
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
					value={floorplanState.floorplanScale}
					oninput={handleOpacityChange}
					class="opacity-slider"
				/>
				<span class="opacity-value">{Math.round(floorplanState.floorplanScale * 100)}%</span>
			</div>

			{#if detecting}
				<div class="calibration-section">
					<span class="calibration-status">Detecting boundary...</span>
				</div>
			{:else if (detectedWorldArea || wallState.wallMask) && !calibrationDone}
				<div class="calibration-section">
					<span class="calibration-label">What is the total area of the floorplan?</span>
					<div class="calibration-input-row">
						<input
							type="number"
							class="area-input"
							placeholder="e.g. 200"
							bind:value={areaInput}
							onkeydown={handleAreaKeydown}
							min="1"
							step="any"
						/>
						<button
							class="unit-toggle"
							onclick={() => (areaUnit = areaUnit === 'sqm' ? 'sqft' : 'sqm')}
						>
							{areaUnit === 'sqm' ? 'sqm' : 'sqft'}
						</button>
						<button class="apply-btn" onclick={applyCalibration}>Apply</button>
					</div>
					<button class="skip-link" onclick={skipCalibration}>Skip</button>
				</div>
			{:else if scaleDisplay}
				<div class="calibration-section">
					<span class="calibration-confirmed">Scale: {scaleDisplay}</span>
					<button class="skip-link" onclick={() => { calibrationDone = false; }}>Recalibrate</button>
				</div>
			{/if}

		</div>
	{/if}

	{#if wallState.wallMask}
		<div class="wall-actions">
			<Button variant="secondary" size="sm" onclick={() => {
				pushState();
				appState.wallEditMode = appState.wallEditLastMode;
			}}>
				<Icon name="eraser" size={14} />
				Edit Walls
			</Button>
			<span class="wall-hint">Click any wall to change its material</span>
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
	.floorplan-controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.floor-strip {
		display: flex;
		gap: 4px;
		overflow-x: auto;
		overflow-y: hidden;
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border-subtle);
		flex-wrap: nowrap;
		min-width: 0;
	}

	.floor-pill {
		padding: 4px 10px;
		border: 1px solid var(--border-default);
		border-radius: 999px;
		flex-shrink: 0;
		background: var(--bg-surface);
		color: var(--text-secondary);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		cursor: pointer;
		white-space: nowrap;
		flex-shrink: 0;
		transition: all var(--transition-fast);
	}

	.floor-pill:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.floor-pill.active {
		border-color: var(--accent-primary);
		color: var(--accent-primary);
		background: var(--accent-primary-glow);
	}

	.floor-pill.add {
		border-style: dashed;
		color: var(--text-tertiary);
		min-width: 28px;
		text-align: center;
	}

	.floor-pill.add:hover {
		border-color: var(--accent-primary-dim);
		color: var(--accent-primary);
	}

	.floor-manager {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.floor-props {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border-subtle);
	}

	.prop-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.prop-label {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		min-width: 80px;
		flex-shrink: 0;
	}

	.prop-input {
		width: 60px;
		height: 24px;
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		text-align: center;
		padding: 0 4px;
	}

	.prop-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.prop-unit {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.floor-action {
		margin-left: 2px;
		font-size: 10px;
		line-height: 1;
		opacity: 0.4;
		cursor: pointer;
		padding: 2px;
	}

	.floor-action:hover {
		opacity: 1;
	}

	.floor-action.delete:hover {
		color: var(--danger, #ef4444);
	}

	.floor-name-input {
		padding: 3px 8px;
		border: 1px solid var(--accent-primary);
		border-radius: 999px;
		background: var(--bg-surface);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		width: 80px;
		outline: none;
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

	.sample-btn:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
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

	.calibration-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--border-subtle);
	}

	.calibration-status {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		font-style: italic;
	}

	.calibration-label {
		font-size: var(--text-xs);
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.calibration-input-row {
		display: flex;
		gap: var(--space-1);
		align-items: center;
	}

	.area-input {
		flex: 1;
		height: 28px;
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		padding: 0 var(--space-2);
		outline: none;
		min-width: 0;
	}

	.area-input:focus {
		border-color: var(--accent-primary);
	}

	.unit-toggle {
		height: 28px;
		padding: 0 var(--space-2);
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-size: var(--text-xs);
		cursor: pointer;
		white-space: nowrap;
	}

	.unit-toggle:hover {
		background: var(--bg-hover);
		border-color: var(--accent-primary-dim);
	}

	.unit-toggle:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.apply-btn {
		height: 28px;
		padding: 0 var(--space-2);
		background: var(--accent-primary);
		border: none;
		border-radius: var(--radius-md);
		color: var(--text-on-accent, #fff);
		font-size: var(--text-xs);
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
	}

	.apply-btn:hover {
		opacity: 0.9;
	}

	.apply-btn:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.skip-link {
		background: none;
		border: none;
		color: var(--text-tertiary);
		font-size: var(--text-xs);
		cursor: pointer;
		padding: 0;
		text-decoration: underline;
		align-self: flex-start;
	}

	.skip-link:hover {
		color: var(--text-secondary);
	}

	.skip-link:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.calibration-confirmed {
		font-size: var(--text-xs);
		color: var(--color-success, #4ade80);
		font-family: var(--font-mono);
	}

	.wall-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--border-subtle);
	}

	.wall-actions :global(.btn) {
		width: 100%;
	}

	.wall-hint {
		font-size: var(--text-xs);
		color: var(--text-disabled);
	}

	.draw-scratch {
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--border-subtle);
	}

	.draw-scratch :global(.btn) {
		width: 100%;
	}

</style>
