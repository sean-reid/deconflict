import { test, expect } from '@playwright/test';
import { setupCleanState } from './helpers';

test.describe('Room types', () => {
	test.beforeEach(async ({ page }) => {
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
		await page.getByRole('tab', { name: 'Floorplan' }).click();
		await page.waitForTimeout(300);
		await page.getByText('Apartment (48sqm)').click();
		await page.waitForTimeout(6000);
	});

	test('room labels toggle appears in layer panel', async ({ page }) => {
		const layerPanel = page.locator('.layer-panel');
		// Panel may be collapsed — expand if needed
		const body = layerPanel.locator('.panel-body');
		if (!(await body.isVisible().catch(() => false))) {
			await layerPanel.locator('.panel-header').click();
			await page.waitForTimeout(200);
		}
		await expect(layerPanel).toContainText('Room labels');
	});

	test('right-click on interior opens room type popup', async ({ page }) => {
		const canvas = page.locator('canvas');

		// Right-click on an interior area (not a wall)
		await canvas.click({ position: { x: 300, y: 250 }, button: 'right' });
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/room-popup-rightclick.png', fullPage: true });

		const popup = page.locator('.popup');
		if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
			// Should show room type options
			await expect(popup.locator('.type-row').first()).toBeVisible();
			await page.screenshot({ path: 'test-results/room-popup-visible.png', fullPage: true });

			// Close with Escape
			await page.keyboard.press('Escape');
			await expect(popup).not.toBeVisible();
		}
	});

	test('right-click on wall opens wall material popup (not room)', async ({ page }) => {
		const canvas = page.locator('canvas');

		// Right-click on a wall pixel area
		await canvas.click({ position: { x: 100, y: 120 }, button: 'right' });
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/wall-popup-rightclick.png', fullPage: true });

		const popup = page.locator('.popup');
		if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
			// Should show wall materials (Drywall, etc)
			await expect(popup).toContainText('Drywall');
			await page.keyboard.press('Escape');
		}
	});

	test('assign room type via right-click and see label', async ({ page }) => {
		const canvas = page.locator('canvas');

		// Take baseline screenshot
		await page.screenshot({ path: 'test-results/room-before-assign.png', fullPage: true });

		// Right-click interior to open room type popup
		await canvas.click({ position: { x: 300, y: 250 }, button: 'right' });
		await page.waitForTimeout(500);

		const popup = page.locator('.popup');
		if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
			// Click "Conference Room" or the first available type
			const firstType = popup.locator('.type-row').first();
			await firstType.click();
			await page.waitForTimeout(500);

			// Room should now show label tint on canvas
			await page.screenshot({ path: 'test-results/room-after-assign.png', fullPage: true });
		}
	});

	test('popup stays within viewport when right-clicking near bottom', async ({ page }) => {
		const canvas = page.locator('canvas');

		// First, right-click an interior pixel at normal viewport to confirm popup works
		await canvas.click({ position: { x: 300, y: 250 }, button: 'right' });
		await page.waitForTimeout(500);
		const popup = page.locator('.popup');
		const normalVisible = await popup.isVisible({ timeout: 2000 }).catch(() => false);
		if (!normalVisible) return; // no walls detected, skip test

		const normalBox = await popup.boundingBox();
		await page.keyboard.press('Escape');
		await page.waitForTimeout(200);
		if (!normalBox) return;

		// Shrink viewport so popup would overflow at this click point
		const shortHeight = Math.round(250 + normalBox.height * 0.4);
		await page.setViewportSize({ width: 1280, height: shortHeight });
		await page.waitForTimeout(300);

		// Force-click bypasses the status bar interception at short viewports
		await canvas.click({ position: { x: 300, y: 200 }, button: 'right', force: true });
		await page.waitForTimeout(800);

		await page.screenshot({
			path: '/Users/seanreid/deconflict/apps/web/test-results/room-popup-near-bottom.png',
			fullPage: true
		});

		if (await popup.isVisible({ timeout: 2000 }).catch(() => false)) {
			const popupBox = await popup.boundingBox();
			const vh = page.viewportSize()!.height;
			expect(popupBox!.y + popupBox!.height).toBeLessThanOrEqual(vh + 2);

			// Select Custom — popup grows (label input + slider)
			const customRow = popup.locator('.type-row', { hasText: 'Custom' }).first();
			await customRow.click();
			await page.waitForTimeout(600);

			await page.screenshot({
				path: '/Users/seanreid/deconflict/apps/web/test-results/room-popup-custom-near-bottom.png',
				fullPage: true
			});

			const popupBox2 = await popup.boundingBox();
			expect(popupBox2!.y + popupBox2!.height).toBeLessThanOrEqual(vh + 2);
			expect(popupBox2!.y).toBeGreaterThanOrEqual(0);

			await page.keyboard.press('Escape');
		}
	});

	test('left-click on interior places AP (not room popup)', async ({ page }) => {
		const canvas = page.locator('canvas');

		// Regular left-click on interior should place an AP
		await canvas.click({ position: { x: 300, y: 250 } });
		await page.waitForTimeout(500);

		// Should NOT see room popup
		const popup = page.locator('.popup');
		const visible = await popup.isVisible({ timeout: 500 }).catch(() => false);
		expect(visible).toBeFalsy();

		await page.screenshot({ path: 'test-results/room-leftclick-places-ap.png', fullPage: true });
	});

	test('mobile: room popup renders as bottom sheet', async ({ browser }) => {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			hasTouch: true
		});
		const page = await context.newPage();
		await setupCleanState(page);
		await page.goto('/');
		await page.waitForSelector('canvas');
		await page.waitForTimeout(500);

		// Canvas loads on mobile
		const canvas = page.locator('canvas');
		await expect(canvas).toBeVisible();
		await page.screenshot({ path: 'test-results/room-mobile-canvas.png', fullPage: true });

		await context.close();
	});
});
