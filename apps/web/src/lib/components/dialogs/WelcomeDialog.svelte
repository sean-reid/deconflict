<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$components/shared/Button.svelte';

	const STORAGE_KEY = 'deconflict:welcomed';

	let open = $state(false);
	let dontShowAgain = $state(true);

	onMount(() => {
		if (localStorage.getItem(STORAGE_KEY)) return;
		setTimeout(() => {
			open = true;
		}, 500);
	});

	function handleGetStarted() {
		if (dontShowAgain) {
			localStorage.setItem(STORAGE_KEY, '1');
		}
		open = false;
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleGetStarted();
		}
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape' || e.key === 'Enter') {
			handleGetStarted();
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
		aria-label="Welcome to Deconflict"
		onclick={handleOverlayClick}
	>
		<div class="dialog">
			<div class="header">
				<svg class="favicon" width="48" height="48" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<clipPath id="wc-ul"><polygon points="0,0 32,0 0,32"/></clipPath>
						<clipPath id="wc-lr"><polygon points="32,0 32,32 0,32"/></clipPath>
						<clipPath id="wc-cc"><circle cx="16" cy="16" r="14.5"/></clipPath>
					</defs>
					<circle cx="16" cy="16" r="15" fill="#0f1117"/>
					<circle cx="16" cy="16" r="15" fill="none" stroke="#00d4ff" stroke-width="0.75" opacity="0.25"/>
					<g clip-path="url(#wc-cc)">
						<g clip-path="url(#wc-ul)">
							<circle cx="16" cy="16" r="7" fill="none" stroke="#00d4ff" stroke-width="2.25"/>
							<circle cx="16" cy="16" r="11.5" fill="none" stroke="#00d4ff" stroke-width="2" opacity="0.6"/>
						</g>
						<g clip-path="url(#wc-lr)">
							<circle cx="16" cy="16" r="7" fill="none" stroke="#00ff88" stroke-width="2.25"/>
							<circle cx="16" cy="16" r="11.5" fill="none" stroke="#00ff88" stroke-width="2" opacity="0.6"/>
						</g>
						<line x1="2" y1="30" x2="30" y2="2" stroke="#0f1117" stroke-width="1.5"/>
					</g>
					<circle cx="16" cy="16" r="2.5" fill="#ffb800"/>
				</svg>
				<h2 class="title">Deconflict</h2>
				<p class="subtitle">Wireless Channel Planner</p>
			</div>

			<p class="description">
				Plan your WiFi network by placing access points on a floorplan.
				Walls are detected automatically, channels are assigned in real time,
				and you can optimize AP placement for best coverage.
			</p>

			<div class="steps-section">
				<h3 class="steps-heading">HOW IT WORKS</h3>
				<ol class="steps">
					<li>
						<span class="step-number">1</span>
						<span>Drop a floorplan image or pick a sample</span>
					</li>
					<li>
						<span class="step-number">2</span>
						<span>Tap the canvas to place access points</span>
					</li>
					<li>
						<span class="step-number">3</span>
						<span>Toggle the heatmap to see signal coverage</span>
					</li>
					<li>
						<span class="step-number">4</span>
						<span>Use Optimize Placement to improve coverage</span>
					</li>
				</ol>
			</div>

			<div class="actions">
				<Button variant="primary" size="md" onclick={handleGetStarted}>
					Get Started
				</Button>
			</div>

			<label class="checkbox-row">
				<input type="checkbox" bind:checked={dontShowAgain} />
				<span>Don't show this again</span>
			</label>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(10, 12, 18, 0.85);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.dialog {
		background: var(--bg-surface);
		border: 1px solid var(--border-default);
		border-radius: var(--radius-lg, 8px);
		padding: var(--space-6, 24px);
		max-width: 480px;
		width: 90%;
		display: flex;
		flex-direction: column;
		gap: var(--space-4, 16px);
		box-shadow: var(--shadow-lg);
	}

	.header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2, 8px);
	}

	.favicon {
		flex-shrink: 0;
	}

	.title {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xl, 18px);
		font-weight: 600;
		color: var(--accent-primary);
	}

	.subtitle {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--text-secondary);
	}

	.description {
		margin: 0;
		font-size: var(--text-base);
		color: var(--text-secondary);
		line-height: 1.5;
		text-align: center;
	}

	.steps-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2, 8px);
	}

	.steps-heading {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--text-tertiary);
		letter-spacing: 0.08em;
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2, 8px);
	}

	.steps li {
		display: flex;
		align-items: center;
		gap: var(--space-2, 8px);
		font-size: var(--text-sm);
		color: var(--text-primary);
	}

	.step-number {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--accent-primary-glow);
		color: var(--accent-primary);
		font-family: var(--font-mono);
		font-size: var(--text-xs);
		font-weight: 600;
		flex-shrink: 0;
		border: 1px solid rgba(0, 212, 255, 0.25);
	}

	.actions {
		display: flex;
		justify-content: center;
		margin-top: var(--space-1, 4px);
	}

	.actions :global(.btn) {
		min-width: 140px;
		height: 36px;
		font-size: var(--text-base);
	}

	.checkbox-row {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2, 8px);
		font-size: var(--text-sm);
		color: var(--text-tertiary);
		cursor: pointer;
	}

	.checkbox-row input[type="checkbox"] {
		accent-color: var(--accent-primary);
		cursor: pointer;
	}
</style>
