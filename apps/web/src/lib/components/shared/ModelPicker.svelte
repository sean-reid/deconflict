<script lang="ts">
	import { searchModels, getModelsByVendor, type ApModel } from '$lib/data/ap-models.js';

	let {
		value = null,
		onchange
	}: {
		value: string | null;
		onchange: (model: ApModel | null) => void;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let inputEl = $state<HTMLInputElement>();

	let currentLabel = $derived(() => {
		if (!value) return 'Custom';
		const results = searchModels(value);
		const match = results.find((m) => m.id === value);
		return match ? `${match.vendor} ${match.model}` : 'Custom';
	});

	let filteredByVendor = $derived.by(() => {
		const models = query ? searchModels(query) : [...searchModels('')];
		const map = new Map<string, ApModel[]>();
		for (const m of models) {
			const list = map.get(m.vendor) ?? [];
			list.push(m);
			map.set(m.vendor, list);
		}
		return map;
	});

	function handleOpen() {
		open = true;
		query = '';
		setTimeout(() => inputEl?.focus(), 0);
	}

	function handleSelect(model: ApModel | null) {
		onchange(model);
		open = false;
		query = '';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
			query = '';
		}
	}
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

<div class="model-picker">
	<button class="trigger" onclick={handleOpen} type="button">
		<span class="trigger-label">{currentLabel()}</span>
		<span class="trigger-chevron">▾</span>
	</button>

	{#if open}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="backdrop" onclick={() => { open = false; }}></div>
		<div class="dropdown">
			<!-- Stop keyboard propagation so Backspace/Delete don't trigger AP deletion -->
			<input
				bind:this={inputEl}
				class="search"
				type="text"
				placeholder="Search models..."
				bind:value={query}
				onkeydown={(e) => e.stopPropagation()}
			/>
			<div class="results">
				{#each [...filteredByVendor.entries()] as [vendor, models]}
					<div class="vendor-group">
						<span class="vendor-name">{vendor}</span>
						{#each models as model}
							<button
								class="model-row"
								class:active={model.id === value}
								onclick={() => handleSelect(model)}
							>
								<span class="model-name">{model.model}</span>
								<span class="model-meta">
									{model.wifiStandard}
									{model.bands.map((b) => b.band === '2.4ghz' ? '2.4' : b.band === '5ghz' ? '5' : '6').join('/')}
								</span>
							</button>
						{/each}
					</div>
				{/each}
				<button
					class="model-row custom"
					class:active={value === null}
					onclick={() => handleSelect(null)}
				>
					Custom (manual settings)
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.model-picker {
		position: relative;
	}

	.trigger {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		height: 28px;
		padding: 0 var(--space-2);
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: border-color var(--transition-fast);
	}

	.trigger:hover {
		border-color: var(--accent-primary-dim);
	}

	.trigger:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.trigger-chevron {
		color: var(--text-tertiary);
		font-size: var(--text-xs);
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
	}

	.dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 41;
		margin-top: 4px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		max-height: 280px;
		display: flex;
		flex-direction: column;
	}

	.search {
		padding: var(--space-2);
		border: none;
		border-bottom: 1px solid var(--border-subtle);
		background: none;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		outline: none;
	}

	.search::placeholder {
		color: var(--text-disabled);
	}

	.results {
		overflow-y: auto;
		padding: var(--space-1);
	}

	.vendor-group {
		margin-bottom: var(--space-1);
	}

	.vendor-name {
		display: block;
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 500;
	}

	.model-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: var(--space-1) var(--space-2);
		padding-left: var(--space-4);
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		cursor: pointer;
		text-align: left;
	}

	.model-row:hover {
		background: var(--bg-hover);
	}

	.model-row.active {
		background: var(--accent-primary-glow);
	}

	.model-row.custom {
		padding-left: var(--space-2);
		margin-top: var(--space-1);
		border-top: 1px solid var(--border-subtle);
		border-radius: 0;
		color: var(--text-secondary);
	}

	.model-meta {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		font-family: var(--font-mono);
	}
</style>
