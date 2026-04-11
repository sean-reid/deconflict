<script lang="ts">
	import { projectState } from '$state/project.svelte.js';
	import { detectBoundary, prepareSvgForDetection, polygonArea } from '$canvas/boundary-detect.js';
	import { detectWalls } from '$canvas/wall-detect.js';
	import { scheduleSave } from '$state/persistence.svelte.js';
	import Button from '$components/shared/Button.svelte';
	import Icon from '$components/shared/Icon.svelte';

	const FLOORPLAN_TARGET_WIDTH = 800;

	let fileInput = $state<HTMLInputElement>();
	let dragOver = $state(false);
	let detecting = $state(false);
	let areaInput = $state('');
	let areaUnit = $state<'sqm' | 'sqft'>('sqm');
	let detectedWorldArea = $state<number | null>(null);
	let calibrationDone = $state(false);

	let hasFloorplan = $derived(projectState.floorplanUrl !== null);

	const sampleFloorplans = [
		{ name: 'Apartment (48sqm)', file: '/samples/apartment-48sqm.png', areaSqm: 48 },
		{ name: 'House (120sqm)', file: '/samples/house-120sqm.png', areaSqm: 120 },
		{ name: 'Office (300sqm)', file: '/samples/office-300sqm.png', areaSqm: 300 },
		{ name: 'West Wing (1580sqft)', file: '/samples/west-wing.svg', areaSqm: 147 }
	];

	let scaleDisplay = $derived(
		projectState.calibration
			? `1px = ${(1 / projectState.calibration.worldUnitsPerMeter).toFixed(2)}m`
			: null
	);

	async function runBoundaryDetection(url: string) {
		detecting = true;
		calibrationDone = false;
		detectedWorldArea = null;
		areaInput = '';
		projectState.calibration = null;
		projectState.floorplanBoundary = null;

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

			// Boundary detection (uses cleaned image to avoid text noise)
			const result = detectBoundary(cleanImg);
			if (result && result.polygon.length >= 3) {
				// Scale using clean image's own dimensions since detection
				// returns coordinates relative to cleanImg
				const cleanScaleFactor = FLOORPLAN_TARGET_WIDTH / cleanImg.naturalWidth;
				const worldPolygon = result.polygon.map((p) => ({
					x: p.x * cleanScaleFactor,
					y: p.y * cleanScaleFactor
				}));
				projectState.floorplanBoundary = worldPolygon;
				detectedWorldArea = polygonArea(worldPolygon);
			}

			// Wall detection uses ORIGINAL image so coordinates
			// match FloorplanLayer exactly (same naturalWidth)
			const walls = detectWalls(originalImg);
			if (walls.length > 0) {
				projectState.walls = walls.map((w) => ({
					x1: w.x1 * scaleFactor,
					y1: w.y1 * scaleFactor,
					x2: w.x2 * scaleFactor,
					y2: w.y2 * scaleFactor,
					thickness: w.thickness * scaleFactor,
					material: 'drywall',
					attenuation: 5
				}));
				scheduleSave();
			}
		} catch (e) {
			console.warn('Detection failed:', e);
		}
		detecting = false;
	}

	function applyCalibration() {
		const val = parseFloat(areaInput);
		if (!val || val <= 0 || !detectedWorldArea) return;
		let realAreaSqm = val;
		if (areaUnit === 'sqft') {
			realAreaSqm = val * 0.092903;
		}
		const worldUnitsPerMeter = Math.sqrt(detectedWorldArea / realAreaSqm);
		projectState.calibration = { worldUnitsPerMeter };

		// Set realistic default radius for existing APs
		// Typical indoor 5 GHz: ~15m, 2.4 GHz: ~30m
		const defaultRadiusMeters = 15;
		const defaultRadiusWorld = Math.round(defaultRadiusMeters * worldUnitsPerMeter);
		for (const ap of projectState.aps) {
			if (ap.interferenceRadius === 150) {
				// Only adjust APs still at the uncalibrated default
				ap.interferenceRadius = defaultRadiusWorld;
			}
		}

		calibrationDone = true;
		scheduleSave();
	}

	function skipCalibration() {
		projectState.floorplanBoundary = null;
		detectedWorldArea = null;
		calibrationDone = true;
	}

	function handleAreaKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			applyCalibration();
		}
	}

	async function loadSample(url: string, knownAreaSqm?: number) {
		if (projectState.floorplanUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(projectState.floorplanUrl);
		}
		try {
			const response = await fetch(url);
			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);
			projectState.floorplanUrl = blobUrl;
			await runBoundaryDetection(blobUrl);

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
		if (projectState.floorplanUrl?.startsWith('blob:')) {
			URL.revokeObjectURL(projectState.floorplanUrl);
		}
		const blobUrl = URL.createObjectURL(file);
		projectState.floorplanUrl = blobUrl;
		runBoundaryDetection(blobUrl);
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
		projectState.floorplanBoundary = null;
		projectState.calibration = null;
		projectState.walls = [];
		projectState.aps = [];
		detectedWorldArea = null;
		calibrationDone = false;
		areaInput = '';
		scheduleSave();
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
					<button class="sample-btn" onclick={() => loadSample(sample.file, sample.areaSqm)}>
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

			{#if detecting}
				<div class="calibration-section">
					<span class="calibration-status">Detecting boundary...</span>
				</div>
			{:else if detectedWorldArea && !calibrationDone}
				<div class="calibration-section">
					<span class="calibration-label">Detected area outline. What is the total area?</span>
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
				</div>
			{/if}
		</div>
	{/if}

</div>

<style>
	.floorplan-controls {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
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

	.calibration-confirmed {
		font-size: var(--text-xs);
		color: var(--color-success, #4ade80);
		font-family: var(--font-mono);
	}

</style>
