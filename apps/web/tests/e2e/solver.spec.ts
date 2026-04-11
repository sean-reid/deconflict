import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Solver', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
	});

	test('solve assigns channels to placed APs', async ({ page }) => {
		// Place 3 APs close together so they interfere
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });
		await canvas.click({ position: { x: 350, y: 300 } });
		await canvas.click({ position: { x: 325, y: 350 } });
		await page.waitForTimeout(200);

		// Switch to select tool and click Solve
		await page.getByRole('button', { name: 'Solve', exact: true }).click();
		await page.waitForTimeout(1500);

		// After solving, the status bar should show timing
		const statusBar = page.locator('footer');
		const statusText = await statusBar.textContent();
		expect(statusText).toContain('ms');
	});

	test('results panel shows results after solving', async ({ page }) => {
		// Place 2 APs
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });
		await canvas.click({ position: { x: 400, y: 300 } });
		await page.waitForTimeout(200);

		// Click Solve in toolbar - this auto-switches to Results tab
		await page.getByRole('button', { name: 'Solve', exact: true }).click();
		await page.waitForTimeout(1500);

		// Should see compact stats line with channels, conflicts, and timing
		await expect(page.locator('.quick-stats')).toBeVisible();
		await expect(page.getByText('conflicts')).toBeVisible();
	});
});
