import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test('welcome dialog shows on first visit and can be dismissed', async ({ page }) => {
	// Do NOT call setupCleanState - we want the welcome dialog to appear
	await page.goto('/');

	// Welcome dialog should appear
	await expect(page.getByText('Wireless Channel Planner')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();

	// Dismiss it
	await page.getByRole('button', { name: 'Get Started' }).click();

	// App should be usable now
	await expect(page.locator('canvas')).toBeVisible();
});

test('app loads with dark theme and correct layout', async ({ page }) => {
	await setupCleanState(page);
	await page.goto('/');
	await expect(page.locator('.logo')).toBeVisible();
	await expect(page.locator('canvas')).toBeVisible();
	await expect(page.getByRole('button', { name: 'APs', exact: true })).toBeVisible();
	await expect(page.getByText('Add access points to get started')).toBeVisible();
});

test('toolbar has all expected controls', async ({ page }) => {
	await setupCleanState(page);
	await page.goto('/');
	await expect(page.locator('button[aria-label="Select (V)"]')).toBeVisible();
	await expect(page.locator('button[aria-label="Place AP (P)"]')).toBeVisible();
	await expect(page.locator('button[aria-label="Pan (H)"]')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Solve', exact: true })).toBeVisible();
});
