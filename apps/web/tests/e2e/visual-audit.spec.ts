import { test } from '@playwright/test';
import { setupCleanState } from './helpers';

const SCREENSHOT_DIR = 'test-results/visual-audit';

test.describe('Visual UX Audit Screenshots', () => {
	test('1 - empty state desktop 1440x900', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const page = await context.newPage();
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
		await page.waitForTimeout(500);
		await page.screenshot({ path: `${SCREENSHOT_DIR}/01-empty-desktop.png`, fullPage: false });
		await context.close();
	});

	test('2 - apartment floorplan with walls desktop', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const page = await context.newPage();
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');

		// Switch to Floorplan tab and load apartment sample
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await page.getByText('Apartment (48sqm)').click();
		await page.waitForTimeout(2000); // wait for detection

		await page.screenshot({
			path: `${SCREENSHOT_DIR}/02-apartment-walls-desktop.png`,
			fullPage: false
		});
		await context.close();
	});

	test('3 - 4 APs placed and solved with heatmap desktop', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
		const page = await context.newPage();
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');

		// Place 4 APs
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 400, y: 250 } });
		await canvas.click({ position: { x: 700, y: 250 } });
		await canvas.click({ position: { x: 400, y: 500 } });
		await canvas.click({ position: { x: 700, y: 500 } });
		await page.waitForTimeout(1500); // wait for auto-solve

		// Turn on heatmap via layers panel or keyboard shortcut
		await page.keyboard.press('h');
		await page.waitForTimeout(500);

		await page.screenshot({
			path: `${SCREENSHOT_DIR}/03-4aps-heatmap-desktop.png`,
			fullPage: false
		});
		await context.close();
	});

	test('4 - mobile 375x812 with APs placed', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
		const page = await context.newPage();
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');

		// Place APs
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 100, y: 300 } });
		await canvas.click({ position: { x: 250, y: 300 } });
		await canvas.click({ position: { x: 175, y: 450 } });
		await page.waitForTimeout(1500); // wait for auto-solve

		await page.screenshot({ path: `${SCREENSHOT_DIR}/04-mobile-aps.png`, fullPage: false });
		await context.close();
	});

	test('5 - mobile sidebar open showing AP list', async ({ browser }) => {
		const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
		const page = await context.newPage();
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');

		// Place APs
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 100, y: 300 } });
		await canvas.click({ position: { x: 250, y: 300 } });
		await canvas.click({ position: { x: 175, y: 450 } });
		await page.waitForTimeout(1000);

		// Open sidebar - look for a menu/hamburger button or APs tab
		const apsTab = page.getByRole('tab', { name: 'APs' });
		if (await apsTab.isVisible()) {
			await apsTab.click();
		}
		await page.waitForTimeout(500);

		await page.screenshot({
			path: `${SCREENSHOT_DIR}/05-mobile-sidebar-aplist.png`,
			fullPage: false
		});
		await context.close();
	});
});
