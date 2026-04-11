import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Export', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
	});

	test('results panel shows export sections and toolbar has save/open', async ({ page }) => {
		// Place an AP first
		await page.locator('canvas').click({ position: { x: 300, y: 300 } });

		// Go to Results tab
		await page.getByRole('tab', { name: 'Results' }).click();

		// Export section should be visible in Results panel
		await expect(page.getByText('EXPORT', { exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Export PNG' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Export PDF' })).toBeVisible();

		// Save and Open are now in the toolbar
		await expect(page.locator('header').getByLabel('Save project')).toBeVisible();
		await expect(page.locator('header').getByLabel('Open project')).toBeVisible();
	});

	test('save project JSON via toolbar button', async ({ page }) => {
		// Place 2 APs
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 200, y: 200 } });
		await canvas.click({ position: { x: 400, y: 300 } });

		// Intercept the download - Save is now in the toolbar
		const downloadPromise = page.waitForEvent('download');
		await page.locator('header').getByLabel('Save project').click();
		const download = await downloadPromise;

		// Verify file was downloaded
		expect(download.suggestedFilename()).toContain('.deconflict.json');
	});
});
