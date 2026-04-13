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
					Free, open-source WiFi channel planner. Import a floorplan, place access points,
					and get optimal channel assignments with physics-based signal coverage.
				</p>

				<section class="section">
					<h3 class="section-heading">GETTING STARTED</h3>
					<ul class="quick-start">
						<li>Import a floorplan image (PNG, JPEG, SVG) or draw walls from scratch</li>
						<li>Walls are detected automatically with per-material RF attenuation</li>
						<li>Tap the canvas to place access points</li>
						<li>Select an AP model from 100+ real devices to auto-fill specs</li>
						<li>Channels are assigned automatically using graph coloring</li>
						<li>Toggle the heatmap to see signal coverage through walls</li>
						<li>Run Optimize Placement to find the best AP positions</li>
					</ul>
				</section>

				<section class="section">
					<h3 class="section-heading">WALL MATERIALS</h3>
					<ul class="quick-start">
						<li>Change the default wall material in the sidebar dropdown</li>
						<li>Click a wall to override its material (glass, brick, concrete, etc.)</li>
						<li>Edit Walls mode lets you erase, draw, or paint materials with a brush</li>
						<li>Each material has a realistic RF attenuation value (2-20 dB)</li>
					</ul>
				</section>

				<section class="section">
					<h3 class="section-heading">HEATMAP</h3>
					<ul class="quick-start">
						<li>Signal uses indoor path loss model with per-material wall attenuation</li>
						<li>Coverage radius is derived from TX power (adjustable per AP)</li>
						<li>Heatmap updates in real time as you move APs</li>
						<li>Colors: green (excellent) to red (poor) to transparent (no signal)</li>
					</ul>
				</section>

				<section class="section desktop-only">
					<h3 class="section-heading">KEYBOARD SHORTCUTS</h3>
					<div class="shortcuts">
						<div class="shortcut-row"><kbd>G</kbd><span>Toggle grid</span></div>
						<div class="shortcut-row"><kbd>W</kbd><span>Toggle walls</span></div>
						<div class="shortcut-row"><kbd>H</kbd><span>Toggle heatmap</span></div>
						<div class="shortcut-row"><kbd>L</kbd><span>Toggle labels</span></div>
						<div class="shortcut-row"><kbd>Ctrl+Z</kbd><span>Undo</span></div>
						<div class="shortcut-row"><kbd>Ctrl+Shift+Z</kbd><span>Redo</span></div>
						<div class="shortcut-row"><kbd>Delete</kbd><span>Remove selected AP(s)</span></div>
						<div class="shortcut-row"><kbd>Ctrl+A</kbd><span>Select all APs</span></div>
					</div>
				</section>

				<section class="section">
					<h3 class="section-heading">BANDS</h3>
					<div class="bands">
						<div class="band-row">
							<span class="band-name">2.4 GHz</span>
							<span class="band-desc">3 non-overlapping channels (1, 6, 11). Best range.</span>
						</div>
						<div class="band-row">
							<span class="band-name">5 GHz</span>
							<span class="band-desc">Up to 25 channels, wider bandwidth. Most common.</span>
						</div>
						<div class="band-row">
							<span class="band-name">6 GHz</span>
							<span class="band-desc">59 channels, newest and least congested. WiFi 6E/7.</span>
						</div>
					</div>
				</section>

				<section class="section footer-section">
					<p class="credit">
						Created by <a href="https://sean-reid.github.io" target="_blank" rel="noopener">Sean Reid</a>
					</p>
					<p class="credit">
						<a href="https://github.com/sean-reid/deconflict" target="_blank" rel="noopener">Source on GitHub</a>
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

	@media (max-width: 768px) {
		.desktop-only {
			display: none;
		}

		.dialog {
			max-width: 100%;
			max-height: 90vh;
			margin: 0 var(--space-3);
		}
	}
</style>
