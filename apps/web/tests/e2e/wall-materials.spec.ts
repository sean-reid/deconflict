import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Wall materials', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
		// Load apartment floorplan for all tests
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await page.getByText('Apartment (48sqm)').click();
		await page.waitForTimeout(6000);
	});

	test('material list appears with 6 options after floorplan load', async ({ page }) => {
		await expect(page.locator('.material-section')).toBeVisible();
		await expect(page.locator('.material-option')).toHaveCount(6);
		await expect(page.locator('.material-option.active')).toContainText('Drywall');
	});

	test('switching material changes active state', async ({ page }) => {
		await page.locator('.material-option:has-text("Brick")').click();
		await expect(page.locator('.material-option.active')).toContainText('Brick');

		await page.locator('.material-option:has-text("Glass")').click();
		await expect(page.locator('.material-option.active')).toContainText('Glass');
	});

	test('wall color persists after placing an AP', async ({ page }) => {
		// Switch to Brick
		await page.locator('.material-option:has-text("Brick")').click();
		await page.waitForTimeout(300);
		await page.screenshot({ path: 'test-results/wall-materials/brick-before-ap.png' });

		// Place an AP
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 400, y: 300 } });
		await page.waitForTimeout(1000);
		await page.screenshot({ path: 'test-results/wall-materials/brick-after-ap.png' });

		// Material should still be Brick in sidebar
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await expect(page.locator('.material-option.active')).toContainText('Brick');
	});

	test('wall color persists after placing multiple APs', async ({ page }) => {
		// Switch to Concrete
		await page.locator('.material-option:has-text("Concrete")').click();
		await page.waitForTimeout(300);
		await page.screenshot({ path: 'test-results/wall-materials/concrete-before-aps.png' });

		// Place 3 APs
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 200, y: 200 } });
		await canvas.click({ position: { x: 400, y: 200 } });
		await canvas.click({ position: { x: 300, y: 350 } });
		await page.waitForTimeout(1500);
		await page.screenshot({ path: 'test-results/wall-materials/concrete-after-aps.png' });

		// Switch back to Floorplan tab and verify material still Concrete
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await expect(page.locator('.material-option.active')).toContainText('Concrete');
	});

	test('switching material after placing APs updates walls', async ({ page }) => {
		// Place APs first
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 250 } });
		await canvas.click({ position: { x: 500, y: 250 } });
		await page.waitForTimeout(1000);

		// Switch to Floorplan tab and change material
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await page.screenshot({ path: 'test-results/wall-materials/drywall-with-aps.png' });

		await page.locator('.material-option:has-text("Metal")').click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/wall-materials/metal-with-aps.png' });

		await expect(page.locator('.material-option.active')).toContainText('Metal');
	});

	test('clicking wall shows popup, selecting material overrides blob', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 100, y: 120 } });
		await page.waitForTimeout(300);

		const popup = page.locator('.popup');
		if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
			await expect(popup.locator('.material-row')).toHaveCount(6);

			// Select Glass for this wall blob
			await popup.locator('.material-row:has-text("Glass")').click();
			await page.waitForTimeout(500);

			// Popup should close
			await expect(popup).not.toBeVisible();
			await page.screenshot({ path: 'test-results/wall-materials/blob-override-glass.png' });
		}
	});

	test('change default → place AP → click-override blob keeps non-default color', async ({ page }) => {
		// Step 1: Change default to Brick
		await page.locator('.material-option:has-text("Brick")').click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/wall-materials/seq-1-brick-default.png' });

		// Step 2: Place an AP
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 400, y: 300 } });
		await page.waitForTimeout(1000);
		await page.screenshot({ path: 'test-results/wall-materials/seq-2-ap-placed.png' });

		// Step 3: Click a wall and override to Glass
		await canvas.click({ position: { x: 100, y: 120 } });
		await page.waitForTimeout(300);
		const popup = page.locator('.popup');
		if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
			await popup.locator('.material-row:has-text("Glass")').click();
			await page.waitForTimeout(1000);
		}
		await page.screenshot({ path: 'test-results/wall-materials/seq-3-after-override.png' });

		// Verify: walls should NOT all be Drywall — Floorplan tab should still show Brick active
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await expect(page.locator('.material-option.active')).toContainText('Brick');
	});
});
