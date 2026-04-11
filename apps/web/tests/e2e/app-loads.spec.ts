import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test('welcome dialog shows on first visit and can be dismissed', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Wireless Channel Planner')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
	await page.getByRole('button', { name: 'Get Started' }).click();
	await expect(page.locator('canvas')).toBeVisible();
});

test('app loads with dark theme and correct layout', async ({ page }) => {
	await setupCleanState(page);
	await page.goto('/');
	await expect(page.locator('.logo')).toBeVisible();
	await expect(page.locator('canvas')).toBeVisible();
	await expect(page.getByRole('tab', { name: 'APs' })).toBeVisible();
	await expect(page.getByText('Add access points to get started')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Solve', exact: true })).toBeVisible();
});
