import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Export', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
	});

	test('export panel shows all sections', async ({ page }) => {
		// Place an AP first
		await page.locator('button[aria-label="Place AP (P)"]').click();
		await page.locator('canvas').click({ position: { x: 300, y: 300 } });
		await page.locator('button[aria-label="Select (V)"]').click();

		// Go to Export tab
		await page.getByRole('button', { name: 'Export' }).click();

		// All sections should be visible
		await expect(page.getByText('PROJECT FILE')).toBeVisible();
		await expect(page.getByText('IMAGE EXPORT')).toBeVisible();
		await expect(page.getByText('PDF REPORT')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Save Project' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Load Project' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Export PNG' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Generate Report' })).toBeVisible();
	});

	test('save and load project JSON roundtrip', async ({ page }) => {
		// Place 2 APs
		await page.locator('button[aria-label="Place AP (P)"]').click();
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 200, y: 200 } });
		await canvas.click({ position: { x: 400, y: 300 } });
		await page.locator('button[aria-label="Select (V)"]').click();

		// Go to Export tab
		await page.getByRole('button', { name: 'Export' }).click();

		// Intercept the download
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Save Project' }).click();
		const download = await downloadPromise;

		// Verify file was downloaded
		expect(download.suggestedFilename()).toContain('.deconflict.json');
	});
});
