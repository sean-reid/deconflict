import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Solver', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
	});

	test('auto-solve assigns channels to placed APs', async ({ page }) => {
		// Place 3 APs close together so they interfere
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });
		await canvas.click({ position: { x: 350, y: 300 } });
		await canvas.click({ position: { x: 325, y: 350 } });

		// Auto-solve should run; go to AP list and check channels assigned
		await page.waitForTimeout(2000);
		await page.getByText('All APs').click();
		await page.waitForTimeout(500);

		// At least one AP should have a channel number visible
		const apRows = page.locator('.row .channel:not(.unassigned)');
		await expect(apRows.first()).toBeVisible();
	});
});
