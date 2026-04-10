import { test, expect } from '@playwright/test';

test.describe('AP placement', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('canvas');
	});

	test('place an AP by clicking the canvas with the Place tool', async ({ page }) => {
		// Switch to Place tool
		await page.locator('button[aria-label="Place AP (P)"]').click();

		// Click on the canvas
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });

		// AP should appear in the sidebar list
		await expect(page.locator('text=AP-1')).toBeVisible();
	});

	test('place multiple APs in rapid succession', async ({ page }) => {
		await page.locator('button[aria-label="Place AP (P)"]').click();

		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 200, y: 200 } });
		await canvas.click({ position: { x: 400, y: 200 } });
		await canvas.click({ position: { x: 300, y: 350 } });

		await expect(page.locator('text=AP-1')).toBeVisible();
		await expect(page.locator('text=AP-2')).toBeVisible();
		await expect(page.locator('text=AP-3')).toBeVisible();
	});

	test('select an AP by clicking it', async ({ page }) => {
		// Place an AP
		await page.locator('button[aria-label="Place AP (P)"]').click();
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });

		// Switch to select and click the AP
		await page.locator('button[aria-label="Select (V)"]').click();
		await canvas.click({ position: { x: 300, y: 300 } });

		// AP should be selected in sidebar (check for the editor showing properties)
		await expect(page.locator('text=PROPERTIES')).toBeVisible();
		await expect(page.locator('input[aria-label="AP name"]')).toBeVisible();
	});

	test('edit AP name in the sidebar', async ({ page }) => {
		// Place and select an AP
		await page.locator('button[aria-label="Place AP (P)"]').click();
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });

		await page.locator('button[aria-label="Select (V)"]').click();
		await canvas.click({ position: { x: 300, y: 300 } });

		// Edit the name
		const nameInput = page.locator('input[aria-label="AP name"]');
		await nameInput.fill('Lobby-North');

		// Name should update in the list
		await expect(page.locator('text=Lobby-North')).toBeVisible();
	});

	test('delete an AP using the sidebar button', async ({ page }) => {
		// Place an AP
		await page.locator('button[aria-label="Place AP (P)"]').click();
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });

		// Select it
		await page.locator('button[aria-label="Select (V)"]').click();
		await canvas.click({ position: { x: 300, y: 300 } });

		// Delete it
		await page.locator('text=Delete Access Point').click();

		// Should be gone
		await expect(page.locator('text=No access points yet')).toBeVisible();
	});

	test('change AP band in the editor', async ({ page }) => {
		// Place and select
		await page.locator('button[aria-label="Place AP (P)"]').click();
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 300, y: 300 } });
		await page.locator('button[aria-label="Select (V)"]').click();
		await canvas.click({ position: { x: 300, y: 300 } });

		// Change band to 2.4 GHz using the sidebar select
		// The Band select is in the editor, after PROPERTIES header
		// It currently shows "5 GHz" - we need the select inside the .editor section
		const bandSelect = page.locator('.editor select').first();
		await bandSelect.selectOption('2.4ghz');

		// The list should now show 2.4G
		await expect(page.locator('text=2.4G')).toBeVisible();
	});
});
