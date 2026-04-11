import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Algorithm Comparison', () => {
	test('compare all algorithms and show results', async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');

		// Place 3 APs
		await page.locator('button[aria-label="Place AP (P)"]').click();
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 250, y: 250 } });
		await canvas.click({ position: { x: 350, y: 250 } });
		await canvas.click({ position: { x: 300, y: 350 } });

		// Switch to Compare tab
		await page.locator('button[aria-label="Select (V)"]').click();
		await page.getByRole('tab', { name: 'Compare' }).click();

		// Click Compare All
		await page.getByRole('button', { name: 'Compare All' }).click();
		await page.waitForTimeout(2000);

		// Should see all 4 algorithm names in the results table
		await expect(page.getByRole('cell', { name: 'Greedy' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'DSatur' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Welsh-Powell' })).toBeVisible();
		await expect(page.getByRole('cell', { name: 'Backtracking' })).toBeVisible();
	});
});
