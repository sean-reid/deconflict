<script lang="ts">
	import Button from '$components/shared/Button.svelte';
	import { parseScale } from '$canvas/pdf-import-math.js';
	import {
		pdfImportState,
		submitPdfScale,
		cancelPdfScale,
		closePdfImport
	} from '$state/pdf-import.svelte.js';

	const PRESETS = [50, 100, 200];
	const DEFAULT_SCALE_TEXT = '1:100';

	let scaleText = $state(DEFAULT_SCALE_TEXT);
	let scaleInput = $state<HTMLInputElement>();

	let denominator = $derived(parseScale(scaleText));
	let invalid = $derived(denominator === null);
	let asking = $derived(pdfImportState.open && pdfImportState.phase === 'scale');
	let heading = $derived(
		pdfImportState.phase === 'scale'
			? 'Import PDF floorplan'
			: pdfImportState.phase === 'importing'
				? 'Importing PDF'
				: 'PDF import failed'
	);

	$effect(() => {
		if (asking) {
			scaleText = DEFAULT_SCALE_TEXT;
			scaleInput?.focus();
			scaleInput?.select();
		}
	});

	function handleImport() {
		if (denominator === null) return;
		submitPdfScale(denominator);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!pdfImportState.open) return;
		if (pdfImportState.phase === 'scale') {
			if (e.key === 'Escape') cancelPdfScale();
		} else if (pdfImportState.phase === 'error') {
			if (e.key === 'Escape' || e.key === 'Enter') {
				e.preventDefault();
				closePdfImport();
			}
		}
	}

	function handleInputKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleImport();
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target !== e.currentTarget) return;
		if (pdfImportState.phase === 'scale') cancelPdfScale();
		else if (pdfImportState.phase === 'error') closePdfImport();
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if pdfImportState.open}
	<div class="overlay" role="presentation" onclick={handleOverlayClick}>
		<div class="dialog" role="dialog" aria-modal="true" aria-label={heading} tabindex="-1">
			<h2 class="heading">{heading}</h2>

			{#if pdfImportState.phase === 'scale'}
				<p class="message">
					What is the scale of the drawing? It is used to set the real-world size of each page.
					If you don't know it, you can set the scale from the floor area afterwards.
				</p>
				<div class="presets" role="group" aria-label="Common scales">
					{#each PRESETS as preset}
						<button
							type="button"
							class="preset"
							class:active={denominator === preset}
							onclick={() => { scaleText = `1:${preset}`; }}
						>
							1:{preset}
						</button>
					{/each}
				</div>
				<label class="field">
					<span class="field-label">Scale</span>
					<input
						bind:this={scaleInput}
						bind:value={scaleText}
						onkeydown={handleInputKeyDown}
						class="scale-input"
						class:invalid
						type="text"
						inputmode="text"
						placeholder="e.g. 1:100"
						autocomplete="off"
						spellcheck="false"
						aria-invalid={invalid}
					/>
				</label>
				{#if invalid}
					<p class="hint error">Enter a scale such as 1:100, 1/100 or 100.</p>
				{/if}
				<div class="actions">
					<Button variant="ghost" onclick={cancelPdfScale}>Cancel</Button>
					<Button variant="secondary" onclick={() => submitPdfScale(null)}>I don't know</Button>
					<Button variant="primary" disabled={invalid} onclick={handleImport}>Import</Button>
				</div>
			{:else if pdfImportState.phase === 'importing'}
				<p class="message" role="status" aria-live="polite">
					{#if pdfImportState.pages > 0}
						Importing page {pdfImportState.page} of {pdfImportState.pages}
					{:else}
						Opening PDF...
					{/if}
				</p>
			{:else}
				<p class="message error" role="alert">{pdfImportState.error}</p>
				<div class="actions">
					<Button variant="primary" onclick={closePdfImport}>Close</Button>
				</div>
			{/if}
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
		max-width: 420px;
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

	.message {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		line-height: 1.5;
	}

	.message.error {
		color: var(--danger, #ef4444);
	}

	.presets {
		display: flex;
		gap: var(--space-2, 8px);
	}

	.preset {
		flex: 1;
		height: 32px;
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-secondary);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.preset:hover {
		background: var(--bg-hover);
		border-color: var(--accent-primary-dim);
	}

	.preset.active {
		border-color: var(--accent-primary);
		color: var(--accent-primary);
		background: var(--accent-primary-glow);
	}

	.preset:focus-visible {
		outline: 2px solid var(--accent-primary);
		outline-offset: 1px;
	}

	.field {
		display: flex;
		align-items: center;
		gap: var(--space-2, 8px);
	}

	.field-label {
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		flex-shrink: 0;
	}

	.scale-input {
		flex: 1;
		height: 32px;
		min-width: 0;
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-md);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		padding: 0 var(--space-2, 8px);
		outline: none;
	}

	.scale-input:focus {
		border-color: var(--accent-primary);
	}

	.scale-input.invalid {
		border-color: var(--danger, #ef4444);
	}

	.hint {
		margin: calc(var(--space-1, 4px) * -1) 0 0;
		font-size: var(--text-xs);
		line-height: 1.4;
	}

	.hint.error {
		color: var(--danger, #ef4444);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2, 8px);
		margin-top: var(--space-2, 8px);
	}
</style>
