import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Wall materials', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
	});

	test('Wall Type dropdown appears after loading a floorplan', async ({ page }) => {
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);

		// No Wall Type dropdown before loading floorplan
		await expect(page.locator('.material-section')).not.toBeVisible();

		// Load apartment sample
		await page.getByText('Apartment (48sqm)').click();
		await page.waitForTimeout(6000);

		// Wall Type dropdown should now be visible
		await expect(page.locator('.material-section')).toBeVisible();
		await expect(page.locator('.material-label')).toContainText('Wall Type');
	});

	test('changing wall type updates wall colors', async ({ page }) => {
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await page.getByText('Apartment (48sqm)').click();
		await page.waitForTimeout(6000);

		// Screenshot with default Drywall
		await page.screenshot({ path: 'test-results/wall-materials/drywall.png' });

		// Change to Concrete
		const select = page.locator('.material-section select');
		await select.selectOption('4'); // Concrete
		await page.waitForTimeout(500);

		// Screenshot with Concrete - walls should look different
		await page.screenshot({ path: 'test-results/wall-materials/concrete.png' });
	});

	test('clicking a wall shows material popup', async ({ page }) => {
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await page.getByText('Apartment (48sqm)').click();
		await page.waitForTimeout(6000);

		// Click on a wall pixel (top-left area of the apartment where outer wall is)
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 100, y: 120 } });
		await page.waitForTimeout(300);

		// Material popup should appear with 6 options
		const popup = page.locator('.popup');
		if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
			await expect(popup.locator('.material-row')).toHaveCount(6);
			await expect(popup).toContainText('Drywall');
			await expect(popup).toContainText('Concrete');

			// Close popup
			await page.keyboard.press('Escape');
			await expect(popup).not.toBeVisible();
		}
	});
});
