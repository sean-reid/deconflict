<script lang="ts">
	import { projectState, updateAp, removeAp, removeAps } from '$state/project.svelte';
	import { canvasState, clearSelection } from '$state/canvas.svelte';
	import { getAvailableChannels } from '@deconflict/channels';
	import type { Band, ChannelWidth } from '@deconflict/channels';
	import { buildInterferenceGraph } from '@deconflict/geometry';
	import Select from '$components/shared/Select.svelte';
	import Button from '$components/shared/Button.svelte';
	import Icon from '$components/shared/Icon.svelte';
	import NumberInput from '$components/shared/NumberInput.svelte';
	import Tooltip from '$components/shared/Tooltip.svelte';

	const bandOptions = [
		{ value: '2.4ghz', label: '2.4 GHz' },
		{ value: '5ghz', label: '5 GHz' },
		{ value: '6ghz', label: '6 GHz' }
	];

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

	let batchRadius = $state(150);

	let radiusDisplay = $derived(
		singleAp
			? projectState.calibration
				? (singleAp.interferenceRadius / projectState.calibration.worldUnitsPerMeter).toFixed(1)
				: String(singleAp.interferenceRadius)
			: ''
	);
	let radiusUnit = $derived(projectState.calibration ? 'm' : 'px');

	$effect(() => {
		if (selectedAps.length > 0) {
			batchRadius = selectedAps[0]?.interferenceRadius ?? 150;
		}
	});

	$effect(() => {
		if (multiSelect) {
			for (const ap of selectedAps) {
				if (ap.interferenceRadius !== batchRadius) {
					updateAp(ap.id, { interferenceRadius: batchRadius });
				}
			}
		}
	});

	let neighbors = $derived.by(() => {
		if (!singleAp) return [];
		const aps = projectState.aps;
		const positions = aps.map(ap => ({
			id: ap.id, x: ap.x, y: ap.y,
			interferenceRadius: ap.interferenceRadius
		}));
		const { edges } = buildInterferenceGraph(positions);
		return edges
			.filter(e => e.a === singleAp.id || e.b === singleAp.id)
			.map(e => {
				const otherId = e.a === singleAp.id ? e.b : e.a;
				const other = aps.find(a => a.id === otherId);
				if (!other) return null;
				const sameChannel = singleAp.assignedChannel !== null
					&& other.assignedChannel !== null
					&& singleAp.assignedChannel === other.assignedChannel;
				return {
					name: other.name,
					overlap: e.overlapFraction,
					sameChannel
				};
			})
			.filter((n): n is { name: string; overlap: number; sameChannel: boolean } => n !== null)
			.sort((a, b) => b.overlap - a.overlap);
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
		const band = val as Band;
		if (singleAp) {
			updateAp(singleAp.id, { band, fixedChannel: null, assignedChannel: null });
		} else if (multiSelect) {
			for (const ap of selectedAps) {
				updateAp(ap.id, { band, fixedChannel: null, assignedChannel: null });
			}
		}
	}

	function handleWidthChange(val: string) {
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
		if (!singleAp) return;
		const fixedChannel = val === '' ? null : Number(val);
		updateAp(singleAp.id, { fixedChannel, assignedChannel: fixedChannel });
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
			<Tooltip text="A label for this access point. Use something descriptive like 'Living Room' or 'Upstairs Hall'." position="left">
				<span class="field-label">Name</span>
			</Tooltip>
			<input
				class="text-input"
				type="text"
				value={singleAp.name}
				oninput={handleNameInput}
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
			<Tooltip text="How far this access point's signal reaches. Typical indoor range: 10-30m for 5 GHz, 30-50m for 2.4 GHz." position="left">
				<span class="field-label">Coverage Radius</span>
			</Tooltip>
			<NumberInput
				bind:value={singleAp.interferenceRadius}
				min={50}
				max={500}
				step={10}
				label={radiusUnit}
			/>
			{#if projectState.calibration}
				<span class="radius-converted">~{radiusDisplay}m</span>
			{/if}
		</div>

		<div class="field">
			<Tooltip text="Transmit power in dBm. Typical home routers are 15-20 dBm. Higher means wider coverage but more interference." position="left">
				<span class="field-label">Power</span>
			</Tooltip>
			<NumberInput
				bind:value={singleAp.power}
				min={0}
				max={30}
				step={1}
				label="dBm"
			/>
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

		{#if neighbors.length > 0}
			<div class="section-header">NEARBY ACCESS POINTS</div>
			<div class="neighbors">
				{#each neighbors as n}
					<div class="neighbor-row">
						<span class="neighbor-name">{n.name}</span>
						<span class="neighbor-overlap" class:low={n.overlap < 0.3} class:med={n.overlap >= 0.3 && n.overlap < 0.6} class:high={n.overlap >= 0.6}>
							{Math.round(n.overlap * 100)}% overlap
						</span>
						{#if n.sameChannel}
							<span class="conflict-badge">conflict</span>
						{/if}
					</div>
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
		<div class="section-header">{selectedAps.length} APs SELECTED</div>

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
			<Tooltip text="How far this access point's signal reaches. Increase for high-power routers, decrease for low-power ones." position="left">
				<span class="field-label">Interference Radius</span>
			</Tooltip>
			<NumberInput
				bind:value={batchRadius}
				min={50}
				max={500}
				step={10}
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
		border-radius: var(--radius-md);
		font-size: var(--text-sm);
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

	.radius-converted {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
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
</style>
