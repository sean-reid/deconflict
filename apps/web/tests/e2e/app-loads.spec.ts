import { test, expect } from '@playwright/test';

test('app loads with dark theme and correct layout', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('text=Deconflict')).toBeVisible();
	// Canvas should be present
	await expect(page.locator('canvas')).toBeVisible();
	// Sidebar should show APs tab
	await expect(page.getByRole('button', { name: 'APs', exact: true })).toBeVisible();
	// Status bar should show
	await expect(page.locator('text=0 access points')).toBeVisible();
});

test('toolbar has all expected controls', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('button[aria-label="Select (V)"]')).toBeVisible();
	await expect(page.locator('button[aria-label="Place AP (P)"]')).toBeVisible();
	await expect(page.locator('button[aria-label="Pan (H)"]')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Solve', exact: true })).toBeVisible();
});
