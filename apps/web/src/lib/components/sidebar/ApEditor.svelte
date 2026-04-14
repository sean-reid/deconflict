<script lang="ts">
	import { projectState, updateAp, removeAp, removeAps, getEffectiveWupm, radiusFromPower } from '$state/project.svelte';
	import { canvasState, clearSelection, selectAp } from '$state/canvas.svelte';
	import { pushState } from '$state/history.svelte';
	import { getAvailableChannels } from '@deconflict/channels';
	import type { Band, ChannelWidth } from '@deconflict/channels';
	import { floorState, getFloor, getFloorSlabAttenuation } from '$state/floor-state.svelte.js';
	import { findModel, getBandSpec, type ApModel } from '$lib/data/ap-models.js';
	import Select from '$components/shared/Select.svelte';
	import Button from '$components/shared/Button.svelte';
	import Icon from '$components/shared/Icon.svelte';
	import NumberInput from '$components/shared/NumberInput.svelte';
	import Tooltip from '$components/shared/Tooltip.svelte';
	import ModelPicker from '$components/shared/ModelPicker.svelte';

	const allBandOptions = [
		{ value: '2.4ghz', label: '2.4 GHz' },
		{ value: '5ghz', label: '5 GHz' },
		{ value: '6ghz', label: '6 GHz' }
	];

	// Constrain band options to what the selected model supports
	let bandOptions = $derived.by(() => {
		if (!singleAp?.modelId) return allBandOptions;
		const model = findModel(singleAp.modelId);
		if (!model) return allBandOptions;
		const supportedBands = new Set(model.bands.map((b) => b.band));
		return allBandOptions.filter((o) => supportedBands.has(o.value as Band));
	});

	const widthsByBand: Record<string, Array<{ value: string; label: string }>> = {
		'2.4ghz': [
			{ value: '20', label: '20 MHz' },
			{ value: '40', label: '40 MHz' }
		],
		'5ghz': [
			{ value: '20', label: '20 MHz' },
			{ value: '40', label: '40 MHz' },
			{ value: '80', label: '80 MHz' },
			{ value: '160', label: '160 MHz' }
		],
		'6ghz': [
			{ value: '20', label: '20 MHz' },
			{ value: '40', label: '40 MHz' },
			{ value: '80', label: '80 MHz' },
			{ value: '160', label: '160 MHz' },
			{ value: '320', label: '320 MHz' }
		]
	};

	const defaultWidths = [{ value: '20', label: '20 MHz' }];

	function getWidths(band: string): Array<{ value: string; label: string }> {
		return widthsByBand[band as keyof typeof widthsByBand] ?? defaultWidths;
	}

	let selectedAps = $derived(
		projectState.aps.filter((a) => canvasState.selectedApIds.includes(a.id))
	);
	let singleAp = $derived(selectedAps.length === 1 ? selectedAps[0] : null);
	let multiSelect = $derived(selectedAps.length > 1);

	let batchPower = $state(20);

	let radiusDisplay = $derived.by(() => {
		if (!singleAp) return '';
		const meters = singleAp.interferenceRadius / getEffectiveWupm();
		if (projectState.unitSystem === 'imperial') {
			return (meters * 3.28084).toFixed(1);
		}
		return meters.toFixed(1);
	});
	let radiusUnit = $derived(
		projectState.unitSystem === 'imperial' ? 'ft' : 'm'
	);

	$effect(() => {
		if (selectedAps.length > 0) {
			batchPower = selectedAps[0]?.power ?? 20;
		}
	});

	// Auto-derive interference radius from power for single AP
	$effect(() => {
		if (singleAp) {
			const derived = radiusFromPower(singleAp.power, singleAp.band);
			if (singleAp.interferenceRadius !== derived) {
				updateAp(singleAp.id, { interferenceRadius: derived });
			}
		}
	});

	// Apply batch power to all selected APs
	$effect(() => {
		if (multiSelect) {
			for (const ap of selectedAps) {
				if (ap.power !== batchPower) {
					const radius = radiusFromPower(batchPower, ap.band);
					updateAp(ap.id, { power: batchPower, interferenceRadius: radius });
				}
			}
		}
	});

	/** APs on the same channel whose signal reaches this AP — actual co-channel interference. */
	let interferers = $derived.by(() => {
		if (!singleAp || singleAp.assignedChannel === null) return [];
		const aps = projectState.aps;
		const results: Array<{ id: string; name: string; signalPct: number }> = [];
		for (const other of aps) {
			if (other.id === singleAp.id) continue;
			if (other.assignedChannel !== singleAp.assignedChannel) continue;
			// Signal from other AP at this AP's position (inverse quartic)
			const dx = singleAp.x - other.x;
			const dy = singleAp.y - other.y;
			const dSq = dx * dx + dy * dy;
			const rSq = other.interferenceRadius * other.interferenceRadius;
			let signal = rSq > 0 ? 1 / (1 + (dSq * dSq) / (rSq * rSq)) : 0;
			// Cross-floor slab attenuation
			if (singleAp.floorId !== other.floorId) {
				const slabDb = getFloorSlabAttenuation(singleAp.floorId, other.floorId, other.band as Band);
				if (slabDb > 0) signal *= Math.pow(10, -slabDb / 10);
			}
			if (signal < 0.005) continue; // below CCA threshold
			results.push({
				id: other.id,
				name: other.name,
				signalPct: Math.round(signal * 100)
			});
		}
		return results.sort((a, b) => b.signalPct - a.signalPct);
	});

	let channelOptions = $derived.by(() => {
		if (!singleAp) return [];
		const channels = getAvailableChannels(
			singleAp.band,
			projectState.regulatoryDomain
		);
		const opts: Array<{ value: string; label: string }> = [
			{ value: '', label: 'Auto' }
		];
		for (const ch of channels) {
			opts.push({ value: String(ch.number), label: String(ch.number) });
		}
		return opts;
	});

	function handleBandChange(val: string) {
		pushState();
		const band = val as Band;
		if (singleAp) {
			const interferenceRadius = radiusFromPower(singleAp.power, band);
			updateAp(singleAp.id, { band, interferenceRadius, fixedChannel: null, assignedChannel: null });
		} else if (multiSelect) {
			for (const ap of selectedAps) {
				const interferenceRadius = radiusFromPower(ap.power, band);
				updateAp(ap.id, { band, interferenceRadius, fixedChannel: null, assignedChannel: null });
			}
		}
	}

	function handleWidthChange(val: string) {
		pushState();
		const channelWidth = Number(val) as ChannelWidth;
		if (singleAp) {
			updateAp(singleAp.id, { channelWidth });
		} else if (multiSelect) {
			for (const ap of selectedAps) {
				updateAp(ap.id, { channelWidth });
			}
		}
	}

	function handleChannelChange(val: string) {
		pushState();
		if (!singleAp) return;
		const fixedChannel = val === '' ? null : Number(val);
		updateAp(singleAp.id, { fixedChannel, assignedChannel: fixedChannel });
	}

	function handleModelChange(model: ApModel | null) {
		pushState();
		if (!singleAp) return;
		if (!model) {
			updateAp(singleAp.id, { modelId: null, modelLabel: null });
			return;
		}
		const spec =
			getBandSpec(model, singleAp.band) ?? getBandSpec(model, projectState.band) ?? model.bands[0];
		if (!spec) return;

		// Set power from model spec — radius is auto-derived by the $effect
		updateAp(singleAp.id, {
			modelId: model.id,
			modelLabel: `${model.vendor} ${model.model}`,
			band: spec.band,
			channelWidth: spec.maxChannelWidth,
			power: spec.maxTxPower,
			interferenceRadius: radiusFromPower(spec.maxTxPower, spec.band),
			fixedChannel: null,
			assignedChannel: null
		});
	}

	function handleNameFocus() {
		pushState();
	}

	function handleNameInput(e: Event) {
		if (!singleAp) return;
		const target = e.target as HTMLInputElement;
		updateAp(singleAp.id, { name: target.value });
	}

	function handleDelete() {
		if (singleAp) {
			removeAp(singleAp.id);
			clearSelection();
		}
	}

	function handleDeleteAll() {
		if (multiSelect) {
			removeAps(canvasState.selectedApIds);
			clearSelection();
		}
	}
</script>

{#if singleAp}
	<div class="editor">
		<button class="back-link" onclick={() => clearSelection()}>
			&larr; All APs ({projectState.aps.length})
		</button>
		<div class="section-header">PROPERTIES</div>

		<div class="field">
			<Tooltip text="Select your AP hardware model to auto-fill band, power, and range settings." position="left">
				<span class="field-label">Model</span>
			</Tooltip>
			<ModelPicker value={singleAp.modelId} onchange={handleModelChange} />
		</div>

		<div class="field">
			<Tooltip text="A label for this access point. Use something descriptive like 'Living Room' or 'Upstairs Hall'." position="left">
				<span class="field-label">Name</span>
			</Tooltip>
			<input
				class="text-input"
				type="text"
				value={singleAp.name}
				oninput={handleNameInput}
				onfocus={handleNameFocus}
				aria-label="AP name"
			/>
		</div>

		<div class="field">
			<Tooltip text="The WiFi frequency band. 2.4 GHz has longer range but fewer channels. 5 GHz is faster with more channels. 6 GHz is newest and least congested." position="left">
				<span class="field-label">Band</span>
			</Tooltip>
			<Select
				value={singleAp.band}
				options={bandOptions}
				onchange={handleBandChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<Tooltip text="Wider channels are faster but more prone to interference. 20 MHz is safest for dense environments." position="left">
				<span class="field-label">Channel Width</span>
			</Tooltip>
			<Select
				value={String(singleAp.channelWidth)}
				options={getWidths(singleAp.band)}
				onchange={handleWidthChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<Tooltip text="Auto lets the solver pick the best channel. Fix a channel if your router requires a specific one." position="left">
				<span class="field-label">Channel</span>
			</Tooltip>
			<Select
				value={singleAp.fixedChannel != null ? String(singleAp.fixedChannel) : ''}
				options={channelOptions}
				onchange={handleChannelChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<Tooltip text="Transmit power in dBm. Coverage range is derived from this using the indoor path loss model." position="left">
				<span class="field-label">TX Power</span>
			</Tooltip>
			<NumberInput
				bind:value={singleAp.power}
				min={1}
				max={36}
				step={1}
				label="dBm"
			/>
			<span class="field-hint">Est. range: {radiusDisplay} {radiusUnit}</span>
		</div>

		<div class="field">
			<span class="field-label">Position</span>
			<div class="position-row">
				<div class="position-field">
					<span class="pos-label">X</span>
					<span class="pos-value">{Math.round(singleAp.x)}</span>
				</div>
				<div class="position-field">
					<span class="pos-label">Y</span>
					<span class="pos-value">{Math.round(singleAp.y)}</span>
				</div>
			</div>
		</div>

		{#if interferers.length > 0}
			<div class="section-header">CO-CHANNEL INTERFERENCE ({interferers.length})</div>
			<div class="neighbors">
				{#each interferers.slice(0, 5) as n}
					<button class="neighbor-row clickable" onclick={() => selectAp(n.id)}>
						<span class="neighbor-name">{n.name}</span>
						<span class="neighbor-overlap high">
							{n.signalPct}%
						</span>
					</button>
				{/each}
			</div>
		{/if}

		<div class="delete-section">
			<Button variant="danger" size="sm" onclick={handleDelete}>
				<Icon name="trash" size={14} />
				Delete Access Point
			</Button>
		</div>
	</div>
{:else if multiSelect}
	<div class="editor">
		<div class="multi-header">
			<div class="section-header">{selectedAps.length} APs SELECTED</div>
			<button class="deselect-link" onclick={() => clearSelection()}>Deselect</button>
		</div>

		<div class="field">
			<Tooltip text="The WiFi frequency band. 2.4 GHz has longer range but fewer channels. 5 GHz is faster with more channels. 6 GHz is newest and least congested." position="left">
				<span class="field-label">Band</span>
			</Tooltip>
			<Select
				value={selectedAps[0]?.band ?? '5ghz'}
				options={bandOptions}
				onchange={handleBandChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<Tooltip text="Wider channels are faster but more prone to interference. 20 MHz is safest for dense environments." position="left">
				<span class="field-label">Channel Width</span>
			</Tooltip>
			<Select
				value={String(selectedAps[0]?.channelWidth ?? 20)}
				options={getWidths(selectedAps[0]?.band ?? '5ghz')}
				onchange={handleWidthChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<Tooltip text="Transmit power in dBm. Coverage range is derived from this." position="left">
				<span class="field-label">TX Power</span>
			</Tooltip>
			<NumberInput
				bind:value={batchPower}
				min={1}
				max={36}
				step={1}
				label="dBm"
			/>
		</div>

		<div class="delete-section">
			<Button variant="danger" size="sm" onclick={handleDeleteAll}>
				<Icon name="trash" size={14} />
				Delete All
			</Button>
		</div>
	</div>
{/if}

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--border-subtle);
	}

	.section-header {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 500;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.field-label {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.text-input {
		width: 100%;
		height: 28px;
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		padding: 0 var(--space-2);
		outline: none;
		transition: border-color var(--transition-fast);
		box-sizing: border-box;
	}

	.text-input:focus {
		border-color: var(--accent-primary);
	}

	.position-row {
		display: flex;
		gap: var(--space-2);
	}

	.position-field {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex: 1;
		height: 28px;
		padding: 0 var(--space-2);
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
	}

	.pos-label {
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
	}

	.pos-value {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.neighbors {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.neighbor-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		background: var(--bg-surface);
		border: none;
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
		font-family: var(--font-sans);
		width: 100%;
		text-align: left;
	}

	.neighbor-row.clickable {
		cursor: pointer;
	}

	.neighbor-row.clickable:hover {
		background: var(--bg-hover);
	}

	.neighbor-name {
		flex: 1;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.neighbor-overlap {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		white-space: nowrap;
	}

	.neighbor-overlap.low {
		color: var(--color-success);
	}

	.neighbor-overlap.med {
		color: var(--color-warning);
	}

	.neighbor-overlap.high {
		color: var(--color-error);
	}

	.conflict-badge {
		font-size: var(--text-xs);
		font-weight: 500;
		color: var(--color-error);
		background: var(--color-error-dim);
		padding: 0 var(--space-1);
		border-radius: var(--radius-full, 9999px);
		white-space: nowrap;
	}

	.delete-section {
		padding-top: var(--space-3);
		border-top: 1px solid var(--border-subtle);
	}

	.field-hint {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		margin-top: 2px;
	}

	:global(.full-width) {
		width: 100%;
	}

	:global(.full-width select) {
		width: 100%;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		background: none;
		border: none;
		color: var(--accent-primary);
		font-size: var(--text-xs);
		cursor: pointer;
		padding: 0;
		margin-bottom: var(--space-2);
	}

	.back-link:hover {
		text-decoration: underline;
	}

	.back-link:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.multi-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.deselect-link {
		background: none;
		border: none;
		color: var(--accent-primary);
		font-size: var(--text-xs);
		cursor: pointer;
		padding: 0;
	}

	.deselect-link:hover {
		text-decoration: underline;
	}

	.deselect-link:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}
</style>
