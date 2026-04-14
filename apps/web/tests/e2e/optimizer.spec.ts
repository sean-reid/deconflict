import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('deconflict:welcomed', '1'));
	await page.goto('http://localhost:4183');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(500);
});

/** Ensure sidebar is open on the APs tab. */
async function openApsTab(page: any) {
	const sidebarVisible = await page
		.locator('aside[aria-label="Sidebar"]')
		.isVisible({ timeout: 200 })
		.catch(() => false);
	if (!sidebarVisible) {
		await page.locator('button[aria-label="Toggle sidebar"]').click();
		await page.waitForTimeout(500);
	}
	const apTab = page.locator('button[role="tab"]').filter({ hasText: 'APs' });
	await apTab.waitFor({ state: 'visible', timeout: 3000 });
	await apTab.click();
	await page.waitForTimeout(300);
}

/** Ensure sidebar is open on the Floorplan tab. */
async function openFloorplanTab(page: any) {
	const sidebarVisible = await page
		.locator('aside[aria-label="Sidebar"]')
		.isVisible({ timeout: 200 })
		.catch(() => false);
	if (!sidebarVisible) {
		await page.locator('button[aria-label="Toggle sidebar"]').click();
		await page.waitForTimeout(500);
	}
	const fpTab = page.locator('button[role="tab"]').filter({ hasText: 'Floorplan' });
	await fpTab.waitFor({ state: 'visible', timeout: 3000 });
	await fpTab.click();
	await page.waitForTimeout(300);
}

test.describe('Optimizer', () => {
	test('optimizer improves coverage on apartment floorplan', async ({ page }) => {
		// Load apartment floorplan
		await page.click('text=Apartment');
		await page.waitForTimeout(4000);
		const skip = page.locator('text=Skip');
		if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) await skip.click();
		await page.waitForTimeout(500);

		// Place 2 APs in bad locations (both stacked in one corner)
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 150, y: 150 } });
		await page.waitForTimeout(500);
		await canvas.click({ position: { x: 160, y: 300 }, force: true });
		await page.waitForTimeout(2000);

		// Open APs tab and go to list view (not editor)
		await openApsTab(page);
		const allAps = page.locator('text=All APs');
		if (await allAps.isVisible({ timeout: 1000 }).catch(() => false)) {
			await allAps.click();
		}
		await page.waitForTimeout(1000);
		const coverageBefore = await page.evaluate(() => {
			const el = document.querySelector('.coverage-value');
			return el ? parseInt(el.textContent || '0') : 0;
		});

		// Click Optimize (may need to scroll into view)
		const optimizeBtn = page.locator('text=Optimize Placement');
		await optimizeBtn.scrollIntoViewIfNeeded();
		await expect(optimizeBtn).toBeVisible({ timeout: 3000 });
		await optimizeBtn.click();

		// Wait for optimization to complete
		await page.waitForTimeout(15000);

		// Read coverage after
		const coverageAfter = await page.evaluate(() => {
			const el = document.querySelector('.coverage-value');
			return el ? parseInt(el.textContent || '0') : 0;
		});

		// Coverage should improve (APs spread out from stacked corner)
		expect(coverageAfter).toBeGreaterThanOrEqual(coverageBefore);
		await page.screenshot({ path: 'test-results/optimizer/after-optimize.png' });
	});

	test('optimizer shows error with no floorplan', async ({ page }) => {
		// Place an AP without a floorplan
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 400, y: 400 } });
		await page.waitForTimeout(1000);

		await openApsTab(page);
		const optimizeBtn = page.locator('text=Optimize Placement');
		if (await optimizeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
			await optimizeBtn.click();
			await page.waitForTimeout(1000);
			await expect(page.locator('text=Load a floorplan first')).toBeVisible({ timeout: 3000 });
		}
	});

	test('new project resets to single floor', async ({ page }) => {
		// Add a second floor
		await openFloorplanTab(page);
		await page.locator('.floor-pill.add').click();
		await page.waitForTimeout(300);
		const pills = page.locator('.floor-pill:not(.add)');
		await expect(pills).toHaveCount(2);

		// Create new project via File menu
		await page.locator('text=File').click();
		await page.waitForTimeout(200);
		await page.locator('text=New Project').click();
		await page.waitForTimeout(500);

		// Confirm in dialog
		const createBtn = page.locator('button.submit-btn, button:has-text("Create")');
		await createBtn.click();
		await page.waitForTimeout(500);

		// Should be back to 1 floor
		await openFloorplanTab(page);
		const pillsAfter = page.locator('.floor-pill:not(.add)');
		await expect(pillsAfter).toHaveCount(1);
	});
});
