import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Wall editing', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await page.getByText('Apartment (48sqm)').click();
		await page.waitForTimeout(6000);
	});

	test('Edit Walls button enters edit mode with toolbar', async ({ page }) => {
		// Click Edit Walls
		await page.getByText('Edit Walls').click();
		await page.waitForTimeout(300);

		// Toolbar should appear with Erase, Draw, Material, Done
		const toolbar = page.locator('.wall-toolbar');
		await expect(toolbar).toBeVisible();
		await expect(toolbar.locator('text=Erase')).toBeVisible();
		await expect(toolbar.locator('text=Draw')).toBeVisible();
		await expect(toolbar.locator('text=Material')).toBeVisible();
		await expect(toolbar.locator('text=Done')).toBeVisible();

		await page.screenshot({ path: 'test-results/wall-edit/edit-mode.png' });

		// Click Done exits edit mode
		await toolbar.locator('text=Done').click();
		await page.waitForTimeout(300);
		await expect(toolbar).not.toBeVisible();
	});

	test('erase then draw walls, then place AP', async ({ page }) => {
		await page.screenshot({ path: 'test-results/wall-edit/01-before-edit.png' });

		// Enter edit mode
		await page.getByText('Edit Walls').click();
		await page.waitForTimeout(300);

		// Erase some walls (drag across a wall area)
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 120 } });
		await page.waitForTimeout(200);
		await page.screenshot({ path: 'test-results/wall-edit/02-after-erase.png' });

		// Switch to Draw mode
		await page.locator('.wall-toolbar').locator('text=Draw').click();
		await page.waitForTimeout(200);

		// Draw some wall pixels
		await canvas.click({ position: { x: 400, y: 300 } });
		await page.waitForTimeout(200);
		await page.screenshot({ path: 'test-results/wall-edit/03-after-draw.png' });

		// Done
		await page.locator('.wall-toolbar').locator('text=Done').click();
		await page.waitForTimeout(500);

		// Place an AP — should work normally after exiting edit mode
		await canvas.click({ position: { x: 300, y: 250 } });
		await page.waitForTimeout(500);
		await expect(page.locator('input[aria-label="AP name"]')).toBeVisible();
		await page.screenshot({ path: 'test-results/wall-edit/04-ap-after-edit.png' });
	});

	test('material paint mode shows material picker', async ({ page }) => {
		await page.getByText('Edit Walls').click();
		await page.waitForTimeout(300);

		// Switch to Material mode
		await page.locator('.wall-toolbar').locator('text=Material').click();
		await page.waitForTimeout(200);

		// Material picker dots should appear
		const matPicker = page.locator('.mat-picker');
		await expect(matPicker).toBeVisible();
		await expect(matPicker.locator('.mat-option')).toHaveCount(6);

		await page.screenshot({ path: 'test-results/wall-edit/material-paint-mode.png' });

		// Done
		await page.locator('.wall-toolbar').locator('text=Done').click();
	});

	test('full sequence: edit walls → paint material → place APs → re-edit', async ({
		page
	}) => {
		// 1. Edit walls - erase a spot
		await page.getByText('Edit Walls').click();
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 200, y: 120 } });

		// 2. Switch to material mode and paint
		await page.locator('.wall-toolbar').locator('text=Material').click();
		await page.waitForTimeout(200);
		await canvas.click({ position: { x: 300, y: 120 } });

		// 3. Done
		await page.locator('.wall-toolbar').locator('text=Done').click();
		await page.waitForTimeout(500);

		// 4. Place 2 APs
		await canvas.click({ position: { x: 300, y: 200 } });
		await canvas.click({ position: { x: 500, y: 350 } });
		await page.waitForTimeout(1000);

		// 5. Edit walls again - should work
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await page.getByText('Edit Walls').click();
		await expect(page.locator('.wall-toolbar')).toBeVisible();
		await page.locator('.wall-toolbar').locator('text=Done').click();
	});
});
