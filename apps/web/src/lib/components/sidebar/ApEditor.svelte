<script lang="ts">
	import { projectState, updateAp, removeAp, removeAps } from '$state/project.svelte';
	import { canvasState, clearSelection } from '$state/canvas.svelte';
	import { getAvailableChannels } from '@deconflict/channels';
	import type { Band, ChannelWidth } from '@deconflict/channels';
	import Select from '$components/shared/Select.svelte';
	import Button from '$components/shared/Button.svelte';
	import Icon from '$components/shared/Icon.svelte';
	import NumberInput from '$components/shared/NumberInput.svelte';

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

	let selectedAps = $derived(
		projectState.aps.filter((a) => canvasState.selectedApIds.includes(a.id))
	);
	let singleAp = $derived(selectedAps.length === 1 ? selectedAps[0] : null);
	let multiSelect = $derived(selectedAps.length > 1);

	let batchRadius = $state(150);

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
		<div class="section-header">PROPERTIES</div>

		<div class="field">
			<span class="field-label">Name</span>
			<input
				class="text-input"
				type="text"
				value={singleAp.name}
				oninput={handleNameInput}
				aria-label="AP name"
			/>
		</div>

		<div class="field">
			<span class="field-label">Band</span>
			<Select
				value={singleAp.band}
				options={bandOptions}
				onchange={handleBandChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<span class="field-label">Channel Width</span>
			<Select
				value={String(singleAp.channelWidth)}
				options={widthsByBand[singleAp.band] ?? widthsByBand['5ghz']}
				onchange={handleWidthChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<span class="field-label">Channel</span>
			<Select
				value={singleAp.fixedChannel != null ? String(singleAp.fixedChannel) : ''}
				options={channelOptions}
				onchange={handleChannelChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<span class="field-label">Interference Radius</span>
			<NumberInput
				bind:value={singleAp.interferenceRadius}
				min={50}
				max={500}
				step={10}
			/>
		</div>

		<div class="field">
			<span class="field-label">Power</span>
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
			<span class="field-label">Band</span>
			<Select
				value={selectedAps[0]?.band ?? '5ghz'}
				options={bandOptions}
				onchange={handleBandChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<span class="field-label">Channel Width</span>
			<Select
				value={String(selectedAps[0]?.channelWidth ?? 20)}
				options={widthsByBand[selectedAps[0]?.band ?? '5ghz'] ?? widthsByBand['5ghz']}
				onchange={handleWidthChange}
				class="full-width"
			/>
		</div>

		<div class="field">
			<span class="field-label">Interference Radius</span>
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

	.delete-section {
		padding-top: var(--space-3);
		border-top: 1px solid var(--border-subtle);
	}

	:global(.full-width) {
		width: 100%;
	}

	:global(.full-width select) {
		width: 100%;
	}
</style>
