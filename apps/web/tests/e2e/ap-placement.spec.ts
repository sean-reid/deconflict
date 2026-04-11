import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('AP placement', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
	});

	test('place an AP by clicking the canvas', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });

		// AP-1 should show in editor (auto-selected after placement)
		await expect(page.locator('input[aria-label="AP name"]')).toBeVisible();
	});

	test('place multiple APs', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 200, y: 200 } });
		await canvas.click({ position: { x: 400, y: 200 } });
		await canvas.click({ position: { x: 300, y: 350 } });

		// Last placed AP (AP-3) is selected, editor shows
		await expect(page.locator('input[aria-label="AP name"]')).toBeVisible();

		// Click back to see the list
		await page.getByText('All APs').click();
		await page.waitForTimeout(200);

		// AP list shows all 3
		await expect(page.locator('text=AP-1')).toBeVisible();
		await expect(page.locator('text=AP-2')).toBeVisible();
		await expect(page.locator('text=AP-3')).toBeVisible();
	});

	test('select an AP and see editor', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });

		// Editor should show with AP name
		await expect(page.locator('text=PROPERTIES')).toBeVisible();
		await expect(page.locator('input[aria-label="AP name"]')).toBeVisible();
	});

	test('edit AP name', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });

		const nameInput = page.locator('input[aria-label="AP name"]');
		await nameInput.fill('Lobby-North');

		// Name should update
		await expect(nameInput).toHaveValue('Lobby-North');
	});

	test('delete an AP', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });

		await page.locator('text=Delete Access Point').click();

		// Should show empty list
		await expect(page.locator('text=No access points yet')).toBeVisible();
	});

	test('change AP band', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });

		// Change band in editor
		const bandSelect = page.locator('.editor select').first();
		await bandSelect.selectOption('2.4ghz');

		// Go back to list to verify
		await page.getByText('All APs').click();
		await page.waitForTimeout(200);
		await expect(page.locator('text=2.4G')).toBeVisible();
	});
});
