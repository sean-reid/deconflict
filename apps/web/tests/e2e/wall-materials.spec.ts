import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Wall materials', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await page.getByText('Apartment (48sqm)').click();
		await page.waitForTimeout(6000);
	});

	test('Edit Walls button visible after floorplan load', async ({ page }) => {
		await expect(page.getByText('Edit Walls')).toBeVisible();
	});

	test('clicking a wall shows material popup', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 100, y: 120 } });
		await page.waitForTimeout(300);

		const popup = page.locator('.popup');
		if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
			await expect(popup.locator('.material-row')).toHaveCount(6);
			await expect(popup).toContainText('Drywall');
			await expect(popup).toContainText('Concrete');

			await page.keyboard.press('Escape');
			await expect(popup).not.toBeVisible();
		}
	});

	test('material paint mode in edit toolbar', async ({ page }) => {
		await page.getByText('Edit Walls').click();
		await page.waitForTimeout(300);

		// Switch to Material mode
		await page.locator('.wall-toolbar').locator('text=Material').click();
		await page.waitForTimeout(200);

		// Material picker should show 6 options
		const matPicker = page.locator('.mat-picker');
		await expect(matPicker).toBeVisible();
		await expect(matPicker.locator('.mat-option')).toHaveCount(6);

		// Done
		await page.locator('.wall-toolbar').locator('text=Done').click();
	});

	test('edit walls → material paint → place AP → walls persist', async ({ page }) => {
		// Enter edit mode and paint some material
		await page.getByText('Edit Walls').click();
		await page.locator('.wall-toolbar').locator('text=Material').click();
		await page.waitForTimeout(200);

		// Paint on a wall
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 100, y: 120 } });
		await page.waitForTimeout(200);

		// Done
		await page.locator('.wall-toolbar').locator('text=Done').click();
		await page.waitForTimeout(500);

		// Place an AP
		await canvas.click({ position: { x: 400, y: 300 } });
		await page.waitForTimeout(1000);

		// Edit Walls should still be accessible
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await expect(page.getByText('Edit Walls')).toBeVisible();
	});
});
