<script lang="ts">
	import { ROOM_TYPES, DEFAULT_ROOM_TYPE_ID, type BuildingCategory } from '$canvas/room-types.js';

	let {
		x,
		y,
		currentTypeId = 0,
		currentDensity,
		currentLabel,
		category,
		onselect,
		onclose
	}: {
		x: number;
		y: number;
		currentTypeId: number;
		currentDensity?: number;
		currentLabel?: string;
		category?: BuildingCategory;
		onselect: (typeId: number, density: number, customLabel?: string) => void;
		onclose: () => void;
	} = $props();

	let densityOverride = $state(currentDensity ?? ROOM_TYPES.find((t) => t.id === currentTypeId)?.defaultDensity ?? 0.3);
	let customLabel = $state(currentLabel ?? '');
	let search = $state('');
	let searchInput: HTMLInputElement;
	let popupEl: HTMLDivElement;
	let highlightIndex = $state(-1);
	let clampedX = $state(x);
	let clampedY = $state(y);

	const CATEGORY_ORDER: BuildingCategory[] = ['commercial', 'residential', 'education', 'healthcare', 'hospitality', 'industrial'];
	const CATEGORY_LABELS: Record<BuildingCategory, string> = {
		commercial: 'Commercial',
		residential: 'Residential',
		education: 'Education',
		healthcare: 'Healthcare',
		hospitality: 'Hospitality',
		industrial: 'Industrial'
	};

	type RoomTypeEntry = { type: typeof ROOM_TYPES[number]; flatIndex: number };

	interface GroupedTypes {
		groups: { category: BuildingCategory; label: string; entries: RoomTypeEntry[] }[];
		totalCount: number;
	}

	// Group types by every category they belong to, filtered by search
	let grouped = $derived((): GroupedTypes => {
		let types = category ? ROOM_TYPES.filter((t) => t.categories.includes(category)) : [...ROOM_TYPES];
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			types = types.filter((t) =>
				t.name.toLowerCase().includes(q) ||
				t.shortName.toLowerCase().includes(q) ||
				t.categories.some(c => c.toLowerCase().includes(q))
			);
		}

		// When searching, show flat list (no grouping) for faster scanning
		if (search.trim()) {
			const entries = types.map((type, i) => ({ type, flatIndex: i }));
			return { groups: [{ category: 'commercial', label: '', entries }], totalCount: types.length };
		}

		// Group by every category the type belongs to
		const catMap = new Map<BuildingCategory, typeof ROOM_TYPES[number][]>();
		for (const t of types) {
			const cats = category ? [category] : t.categories;
			for (const c of cats) {
				if (!catMap.has(c)) catMap.set(c, []);
				catMap.get(c)!.push(t);
			}
		}

		const groups: GroupedTypes['groups'] = [];
		let idx = 0;
		for (const cat of CATEGORY_ORDER) {
			const items = catMap.get(cat);
			if (!items || items.length === 0) continue;
			const entries = items.map((type) => ({ type, flatIndex: idx++ }));
			groups.push({ category: cat, label: CATEGORY_LABELS[cat], entries });
		}
		return { groups, totalCount: idx };
	});

	function handleSelect(typeId: number) {
		const type = ROOM_TYPES.find((t) => t.id === typeId);
		densityOverride = type?.defaultDensity ?? 0.3;
		customLabel = '';
		onselect(typeId, densityOverride, undefined);
		onclose();
	}

	function handleClear() {
		onselect(0, 0, undefined);
		onclose();
	}

	function findTypeAtIndex(idx: number): typeof ROOM_TYPES[number] | undefined {
		for (const g of grouped().groups) {
			for (const e of g.entries) {
				if (e.flatIndex === idx) return e.type;
			}
		}
		return undefined;
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		const total = grouped().totalCount;
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightIndex = Math.min(highlightIndex + 1, total - 1);
			scrollHighlightIntoView();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightIndex = Math.max(highlightIndex - 1, 0);
			scrollHighlightIntoView();
		} else if (e.key === 'Enter' && highlightIndex >= 0 && highlightIndex < total) {
			e.preventDefault();
			const t = findTypeAtIndex(highlightIndex);
			if (t) handleSelect(t.id);
		} else if (e.key === 'Escape') {
			if (search) { search = ''; highlightIndex = -1; e.stopPropagation(); }
			else onclose();
		}
	}

	function scrollHighlightIntoView() {
		requestAnimationFrame(() => {
			const el = document.querySelector('.type-row.highlight');
			if (el) el.scrollIntoView({ block: 'nearest' });
		});
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	// Reset highlight when search changes
	$effect(() => {
		void search;
		highlightIndex = -1;
	});

	$effect(() => {
		if (searchInput) searchInput.focus();
	});

	// Clamp popup to viewport after mount
	$effect(() => {
		if (!popupEl) return;
		const rect = popupEl.getBoundingClientRect();
		const pad = 8;
		let nx = x;
		let ny = y;
		if (rect.right > window.innerWidth - pad) nx = window.innerWidth - rect.width - pad;
		if (rect.bottom > window.innerHeight - pad) ny = window.innerHeight - rect.height - pad;
		if (nx < pad) nx = pad;
		if (ny < pad) ny = pad;
		clampedX = nx;
		clampedY = ny;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="popup-backdrop" onclick={onclose} oncontextmenu={(e) => { e.preventDefault(); onclose(); }}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="popup"
		bind:this={popupEl}
		style="left: {clampedX}px; top: {clampedY}px"
		onclick={(e) => e.stopPropagation()}
	>
		{#if currentTypeId > 0}
			{@const currentType = ROOM_TYPES.find(t => t.id === currentTypeId)}
			{#if currentType}
				<div class="current-type-header">
					<span
						class="swatch"
						style="background: rgb({currentType.color[0]},{currentType.color[1]},{currentType.color[2]})"
					></span>
					<span class="current-type-name">{currentType.name}</span>
				</div>
			{/if}
		{/if}
		<div class="search-box">
			<input
				bind:this={searchInput}
				bind:value={search}
				type="text"
				class="search-input"
				placeholder="Search rooms..."
				onkeydown={handleSearchKeydown}
			/>
		</div>
		<div class="list-header">
			<span>Room type</span>
			<span>devices/m²</span>
		</div>
		<div class="type-list">
			{#each grouped().groups as group}
				{#if group.label}
					<div class="category-header">{group.label}</div>
				{/if}
				{#each group.entries as entry}
					<button
						class="type-row"
						class:active={entry.type.id === currentTypeId}
						class:highlight={entry.flatIndex === highlightIndex}
						onclick={() => handleSelect(entry.type.id)}
						onpointerenter={() => { highlightIndex = entry.flatIndex; }}
					>
						<span
							class="swatch"
							style="background: rgb({entry.type.color[0]},{entry.type.color[1]},{entry.type.color[2]})"
						></span>
						<span class="type-name">{entry.type.name}</span>
						<span class="type-density">{entry.type.defaultDensity}</span>
					</button>
				{/each}
			{/each}
			{#if grouped().totalCount === 0}
				<div class="no-results">No matching room types</div>
			{/if}
		</div>

		{#if currentTypeId > 0}
			{#if currentTypeId === 1}
				<div class="label-section">
					<div class="input-with-clear">
						<input
							type="text"
							class="label-input"
							placeholder="Custom label..."
							bind:value={customLabel}
							oninput={() => onselect(currentTypeId, densityOverride, customLabel || undefined)}
							onkeydown={(e) => { if (e.key === 'Enter') { onselect(currentTypeId, densityOverride, customLabel || undefined); onclose(); } }}
						/>
						{#if customLabel}
							<button class="clear-input-btn" onclick={() => { customLabel = ''; onselect(currentTypeId, densityOverride, undefined); }} aria-label="Clear label">&times;</button>
						{/if}
					</div>
				</div>
			{/if}
			<div class="density-section">
				<label class="density-label">
					<span>Density</span>
					<span class="density-value">{densityOverride.toFixed(2)} devices/m²</span>
				</label>
				<input
					type="range"
					min="0"
					max="2"
					step="0.05"
					bind:value={densityOverride}
					oninput={() => onselect(currentTypeId, densityOverride, customLabel || undefined)}
				/>
			</div>
			<button class="clear-btn" onclick={handleClear}>Clear</button>
		{/if}
	</div>
</div>

<style>
	.popup-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
	}

	.current-type-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2);
		border-bottom: 1px solid var(--border-subtle);
	}

	.current-type-name {
		font-size: var(--text-sm);
		font-weight: 500;
		color: var(--text-primary);
	}

	.search-box {
		padding: var(--space-1);
		padding-bottom: 0;
	}

	.search-input {
		width: 100%;
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		font-size: 16px; /* prevents iOS zoom */
		height: 28px;
		box-sizing: border-box;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.search-input::placeholder {
		color: var(--text-disabled);
	}

	.no-results {
		padding: var(--space-2);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-align: center;
	}

	.popup {
		position: absolute;
		z-index: 51;
		min-width: 180px;
		max-width: 220px;
		background: var(--bg-secondary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		padding: var(--space-1);
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.type-list {
		max-height: 280px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.list-header {
		display: flex;
		justify-content: space-between;
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
		color: var(--text-disabled);
		border-bottom: 1px solid var(--border-subtle);
	}

	.category-header {
		padding: var(--space-1) var(--space-2);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-top: var(--space-1);
		pointer-events: none;
		user-select: none;
	}

	.category-header:first-child {
		margin-top: 0;
	}

	.type-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		border: none;
		background: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: var(--text-sm);
		color: var(--text-primary);
		text-align: left;
		width: 100%;
	}

	.type-row:hover {
		background: var(--bg-hover);
	}

	.type-row.active {
		background: var(--accent-primary-glow);
	}

	.type-row.highlight {
		background: var(--bg-hover);
	}

	.type-row.active.highlight {
		background: var(--accent-primary-glow);
	}

	.swatch {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		flex-shrink: 0;
	}

	.type-name {
		flex: 1;
	}

	.type-density {
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
	}

	.label-section {
		padding: var(--space-1) var(--space-2);
		border-top: 1px solid var(--border-subtle);
	}

	.input-with-clear {
		position: relative;
		display: flex;
		align-items: center;
	}

	.input-with-clear .label-input {
		padding-right: 24px;
	}

	.clear-input-btn {
		position: absolute;
		right: 4px;
		width: 18px;
		height: 18px;
		padding: 0;
		border: none;
		background: none;
		color: var(--text-tertiary);
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
	}

	.clear-input-btn:hover {
		color: var(--text-primary);
		background: var(--bg-hover);
	}

	.label-input {
		width: 100%;
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		padding: var(--space-1) var(--space-2);
		font-family: var(--font-sans);
		font-size: 16px;
		height: 28px;
		box-sizing: border-box;
	}

	.label-input:focus {
		outline: none;
		border-color: var(--accent-primary);
	}

	.label-input::placeholder {
		color: var(--text-disabled);
	}

	.density-section {
		padding: var(--space-2);
		border-top: 1px solid var(--border-subtle);
	}

	.density-label {
		display: flex;
		justify-content: space-between;
		font-size: var(--text-xs);
		color: var(--text-secondary);
		margin-bottom: var(--space-1);
	}

	.density-value {
		font-family: var(--font-mono);
		color: var(--text-tertiary);
	}

	.density-section input[type='range'] {
		width: 100%;
		accent-color: var(--accent-primary);
	}

	.clear-btn {
		padding: var(--space-1) var(--space-2);
		border: none;
		background: none;
		border-top: 1px solid var(--border-subtle);
		border-radius: 0 0 var(--radius-sm) var(--radius-sm);
		cursor: pointer;
		font-family: var(--font-sans);
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		text-align: center;
	}

	.clear-btn:hover {
		color: var(--color-error);
		background: var(--bg-hover);
	}

	@media (max-width: 768px) {
		.popup {
			position: fixed;
			left: 0 !important;
			right: 0;
			bottom: 0;
			top: auto !important;
			max-width: 100%;
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		}

		.type-list {
			max-height: 50vh;
		}
	}
</style>
