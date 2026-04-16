<script lang="ts">
	let {
		open = $bindable(false)
	}: {
		open: boolean;
	} = $props();

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			open = false;
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_interactive_supports_focus -->
	<div
		class="overlay"
		role="dialog"
		aria-modal="true"
		aria-label="Help"
		onclick={handleOverlayClick}
	>
		<div class="dialog">
			<div class="dialog-header">
				<h2 class="heading">About Deconflict</h2>
				<button class="close-btn" onclick={() => { open = false; }} aria-label="Close">
					&times;
				</button>
			</div>

			<div class="dialog-body">
				<p class="intro">
					Drop a floorplan, place APs, get optimal channels.
					Multi-floor support with physics-based signal propagation through walls and floor slabs.
				</p>

				<section class="section desktop-only">
					<h3 class="section-heading">SHORTCUTS</h3>
					<div class="shortcuts">
						<div class="shortcut-row"><kbd>H</kbd><span>Heatmap</span></div>
						<div class="shortcut-row"><kbd>G</kbd><span>Grid</span></div>
						<div class="shortcut-row"><kbd>W</kbd><span>Walls</span></div>
						<div class="shortcut-row"><kbd>Cmd+Z</kbd><span>Undo</span></div>
						<div class="shortcut-row"><kbd>Delete</kbd><span>Remove AP</span></div>
					</div>
				</section>

				<section class="section">
					<h3 class="section-heading">TIPS</h3>
					<ul class="quick-start">
						<li class="desktop-only">Click a wall to change its material</li>
						<li class="desktop-only">Right-click a room to assign its type and density</li>
						<li class="mobile-only">Tap a wall to change its material</li>
						<li class="mobile-only">Long-press a room to assign its type and density</li>
						<li>Edit Walls to erase, draw, or paint materials</li>
						<li>Add floors in the Floorplan tab</li>
						<li>Optimize Placement finds best AP positions</li>
						<li>Export PDF for a professional site survey report</li>
					</ul>
				</section>

				<section class="section footer-section">
					<p class="credit">
						<a href="https://github.com/sean-reid/deconflict" target="_blank" rel="noopener">Source on GitHub</a>
						&nbsp;&nbsp;|&nbsp;&nbsp;
						Created by <a href="https://sean-reid.github.io" target="_blank" rel="noopener">Sean Reid</a>
					</p>
				</section>
			</div>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(10, 12, 18, 0.8);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.dialog {
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg, 8px);
		max-width: 520px;
		width: 90%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: var(--shadow-lg);
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-5, 20px) var(--space-5, 20px) 0;
	}

	.heading {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--text-lg, 18px);
		font-weight: 600;
		color: var(--text-primary);
	}

	.close-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--text-tertiary);
		font-size: var(--text-xl);
		cursor: pointer;
		transition: all var(--transition-fast);
	}

	.close-btn:hover {
		background: var(--bg-hover);
		color: var(--text-primary);
	}

	.dialog-body {
		padding: var(--space-5, 20px);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-5, 20px);
	}

	.intro {
		margin: 0;
		font-size: var(--text-base);
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2, 8px);
	}

	.section-heading {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-tertiary);
		letter-spacing: 0.08em;
	}

	.quick-start {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-1, 4px);
	}

	.quick-start li {
		font-size: var(--text-sm);
		color: var(--text-secondary);
		line-height: 1.6;
	}

	.quick-start li::before {
		content: '-';
		margin-right: var(--space-2, 8px);
		color: var(--text-tertiary);
	}

	kbd {
		display: inline-block;
		padding: 1px 6px;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		color: var(--text-primary);
		background: var(--bg-primary);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-sm);
		line-height: 1.6;
	}

	.shortcuts {
		display: flex;
		flex-direction: column;
		gap: var(--space-1, 4px);
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		gap: var(--space-3, 12px);
	}

	.shortcut-row kbd {
		min-width: 100px;
		text-align: center;
	}

	.shortcut-row span {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.bands {
		display: flex;
		flex-direction: column;
		gap: var(--space-2, 8px);
	}

	.band-row {
		display: flex;
		align-items: baseline;
		gap: var(--space-3, 12px);
	}

	.band-name {
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		font-weight: 600;
		color: var(--accent-primary);
		min-width: 56px;
		flex-shrink: 0;
	}

	.band-desc {
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.footer-section {
		border-top: 1px solid var(--border-subtle);
		padding-top: var(--space-3, 12px);
	}

	.credit {
		font-size: var(--text-xs);
		color: var(--text-tertiary);
		margin: 0;
		line-height: 1.6;
	}

	.credit a {
		color: var(--accent-primary);
		text-decoration: none;
	}

	.credit a:hover {
		text-decoration: underline;
	}

	.mobile-only {
		display: none;
	}

	@media (max-width: 768px) {
		.desktop-only {
			display: none;
		}

		.mobile-only {
			display: list-item;
		}

		.dialog {
			max-width: 100%;
			max-height: 90vh;
			margin: 0 var(--space-3);
		}
	}
</style>
