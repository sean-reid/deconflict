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
		await page.locator('button[aria-label="Place AP (P)"]').click();
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });
		await canvas.click({ position: { x: 350, y: 300 } });
		await canvas.click({ position: { x: 325, y: 350 } });
		await page.waitForTimeout(200);

		// Switch to select tool and click Solve
		await page.locator('button[aria-label="Select (V)"]').click();
		await page.getByRole('button', { name: 'Solve', exact: true }).click();
		await page.waitForTimeout(1500);

		// After solving, the status bar should show timing
		const statusBar = page.locator('footer');
		const statusText = await statusBar.textContent();
		expect(statusText).toContain('ms');
	});

	test('solver panel shows results after solving', async ({ page }) => {
		// Place 2 APs
		await page.locator('button[aria-label="Place AP (P)"]').click();
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });
		await canvas.click({ position: { x: 400, y: 300 } });
		await page.waitForTimeout(200);

		// Switch to select, then Solver tab
		await page.locator('button[aria-label="Select (V)"]').click();
		await page.getByRole('tab', { name: 'Solver' }).click();
		await page.waitForTimeout(200);

		// Run solver from the panel (scope to sidebar to avoid toolbar button)
		await page
			.getByRole('complementary')
			.getByRole('button', { name: 'Solve', exact: true })
			.click();
		await page.waitForTimeout(1500);

		// Should see results section
		await expect(page.getByText('Colors used')).toBeVisible();
		await expect(page.getByText('Conflicts')).toBeVisible();
		await expect(page.getByText('Time')).toBeVisible();
	});
});
