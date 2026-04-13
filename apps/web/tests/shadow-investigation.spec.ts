import { test } from '@playwright/test';

test('wall shadow behavior investigation', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
	await page.waitForTimeout(1000);

	// Step 1: Dismiss welcome modal
	console.log('Step 1: Dismissing welcome modal...');
	try {
		const closeBtn = page.locator(
			'button:has-text("Close"), button:has-text("Got it"), button:has-text("Get Started"), [aria-label="Close"]'
		);
		if (await closeBtn.first().isVisible({ timeout: 3000 })) {
			await closeBtn.first().click();
		}
	} catch {
		await page.keyboard.press('Escape');
	}
	await page.waitForTimeout(500);

	// Close the sidebar to maximize canvas space
	const sidebarToggle = page.locator('button[aria-label*="sidebar"], button[aria-label*="panel"]');
	if (
		await sidebarToggle
			.first()
			.isVisible({ timeout: 500 })
			.catch(() => false)
	) {
		await sidebarToggle.first().click();
		await page.waitForTimeout(200);
	}

	// Step 2: Click "Draw from Scratch"
	console.log('Step 2: Clicking Draw from Scratch...');
	await page
		.locator('button')
		.filter({ hasText: /Draw from Scratch/i })
		.first()
		.click();
	await page.waitForTimeout(500);

	// Step 4: Draw a prominent horizontal wall using the brush
	console.log('Step 4: Drawing horizontal wall...');

	// Draw thick wall in the center of canvas - multiple overlapping passes
	// Canvas area is roughly 0 to ~960px wide and 40 to ~776px tall
	// Center the wall around x=300-700, y=350
	for (let pass = -4; pass <= 4; pass++) {
		const y = 350 + pass * 2;
		await page.mouse.move(250, y);
		await page.waitForTimeout(30);
		await page.mouse.down();
		for (let i = 0; i <= 50; i++) {
			const x = 250 + (i * 400) / 50; // x from 250 to 650
			await page.mouse.move(x, y, { steps: 1 });
			await page.waitForTimeout(5);
		}
		await page.mouse.up();
		await page.waitForTimeout(20);
	}
	console.log('  Wall drawn (9 passes, x=250-650, y=342-358)');
	await page.waitForTimeout(300);

	// Step 5: Click "Done"
	console.log('Step 5: Clicking Done...');
	await page
		.locator('button')
		.filter({ hasText: /^Done$/i })
		.first()
		.click();
	await page.waitForTimeout(500);

	// Step 7: Place AP directly below wall center
	// Wall is at y~350, place AP at y~500 (well below)
	console.log('Step 7: Placing AP at (450, 500)...');
	await page.mouse.click(450, 500);
	await page.waitForTimeout(1000);

	// Deselect the AP by clicking empty space far from it
	await page.mouse.click(100, 200);
	await page.waitForTimeout(500);

	// Step 9: Toggle heatmap on
	console.log('Step 9: Toggling heatmap...');
	// Expand layers panel if collapsed
	const layersCollapsed = page.locator('.layer-panel .panel-header');
	await layersCollapsed.click();
	await page.waitForTimeout(300);

	// Click "Signal heatmap" layer row
	const heatmapRow = page.locator('button.layer-row', { hasText: 'Signal heatmap' });
	if (await heatmapRow.isVisible().catch(() => false)) {
		await heatmapRow.click();
		console.log('  Heatmap toggled ON');
	} else {
		// Try expanding first
		await layersCollapsed.click();
		await page.waitForTimeout(300);
		await heatmapRow.click();
		console.log('  Heatmap toggled ON (after expanding)');
	}

	// Wait for heatmap to render
	await page.waitForTimeout(2000);

	// Step 11: Full view screenshot - clip to just the canvas area
	console.log('Step 11: Full view screenshot');
	await page.screenshot({
		path: '/tmp/shadow-full.png',
		clip: { x: 0, y: 40, width: 960, height: 740 }
	});

	// Step 12: Zoom in on the wall area using mouse wheel
	console.log('Step 12: Zooming in...');
	// First, center on the wall/AP area
	await page.mouse.move(450, 400);

	// Zoom in 8 times aggressively
	for (let i = 0; i < 8; i++) {
		await page.mouse.wheel(0, -300);
		await page.waitForTimeout(400);
	}
	await page.waitForTimeout(500);

	// Step 13: Close-up screenshot
	console.log('Step 13: Close-up screenshot');
	await page.screenshot({
		path: '/tmp/shadow-close.png',
		clip: { x: 0, y: 40, width: 960, height: 740 }
	});

	// Step 14: Zoom in 5 more times
	console.log('Step 14: Zooming in more...');
	for (let i = 0; i < 5; i++) {
		await page.mouse.wheel(0, -300);
		await page.waitForTimeout(400);
	}
	await page.waitForTimeout(500);

	// Step 15: Very close screenshot
	console.log('Step 15: Very close screenshot');
	await page.screenshot({
		path: '/tmp/shadow-very-close.png',
		clip: { x: 0, y: 40, width: 960, height: 740 }
	});

	// Zoom in 5 more for extreme close
	console.log('Step 16: Extreme zoom...');
	for (let i = 0; i < 5; i++) {
		await page.mouse.wheel(0, -300);
		await page.waitForTimeout(400);
	}
	await page.waitForTimeout(500);

	await page.screenshot({
		path: '/tmp/shadow-extreme-close.png',
		clip: { x: 0, y: 40, width: 960, height: 740 }
	});

	console.log('Done! All screenshots captured.');
});
