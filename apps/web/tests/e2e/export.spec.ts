import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Export', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
	});

	test('file dropdown contains export and project actions', async ({ page }) => {
		// Open the File dropdown in the toolbar
		await page.locator('header .dropdown-trigger').click();

		// Export options should be visible in the dropdown
		await expect(page.getByText('Export as PNG')).toBeVisible();
		await expect(page.getByText('Export as PDF')).toBeVisible();

		// Project actions should also be in the dropdown
		await expect(page.getByText('New Project')).toBeVisible();
		await expect(page.getByText('Open Project...')).toBeVisible();
		await expect(page.getByText('Save Project')).toBeVisible();
	});

	test('save project JSON via file dropdown', async ({ page }) => {
		// Place 2 APs
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 200, y: 200 } });
		await canvas.click({ position: { x: 400, y: 300 } });

		// Intercept the download - Save is now in the File dropdown
		const downloadPromise = page.waitForEvent('download');
		await page.locator('header .dropdown-trigger').click();
		await page.getByText('Save Project').click();
		const download = await downloadPromise;

		// Verify file was downloaded
		expect(download.suggestedFilename()).toContain('.deconflict.json');
	});
});
