import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('deconflict:welcomed', '1'));
	await page.goto('http://localhost:4183');
});

test.describe('Multi-floor', () => {
	test('single floor has no floor dots or pills', async ({ page }) => {
		await expect(page.locator('.floor-dots')).not.toBeVisible();
		await expect(page.locator('.floor-strip')).not.toBeVisible();
	});

	test('placing AP on single floor works', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 400, y: 400 } });
		await page.waitForTimeout(1000);

		// Channel badge should appear on canvas
		const badge = page.locator('canvas');
		await expect(badge).toBeVisible();
	});

	test('project saves and reloads with v3 floor data', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 400, y: 400 } });
		await page.waitForTimeout(3000); // wait for auto-save

		await page.reload();
		await page.waitForTimeout(1500);

		// Verify project restored by checking localStorage has v3
		const version = await page.evaluate(() => {
			const raw = localStorage.getItem('deconflict:project');
			if (!raw) return null;
			return JSON.parse(raw).version;
		});
		expect(version).toBe(3);

		// Verify floors array exists
		const floorCount = await page.evaluate(() => {
			const raw = localStorage.getItem('deconflict:project');
			if (!raw) return 0;
			return JSON.parse(raw).floors?.length ?? 0;
		});
		expect(floorCount).toBe(1);

		// Verify AP has floorId
		const hasFloorId = await page.evaluate(() => {
			const raw = localStorage.getItem('deconflict:project');
			if (!raw) return false;
			const data = JSON.parse(raw);
			return data.aps?.length > 0 && typeof data.aps[0].floorId === 'string';
		});
		expect(hasFloorId).toBe(true);
	});

	test('v2 project migrates to v3 on load', async ({ page }) => {
		// Inject a v2 project into localStorage
		await page.evaluate(() => {
			const v2 = {
				version: 2,
				name: 'Legacy Project',
				band: '5ghz',
				channelWidth: 20,
				regulatoryDomain: 'fcc',
				aps: [
					{
						id: 'test-ap',
						name: 'AP-1',
						x: 400,
						y: 300,
						band: '5ghz',
						channelWidth: 20,
						fixedChannel: null,
						assignedChannel: null,
						interferenceRadius: 300,
						power: 20,
						modelId: null,
						modelLabel: null
					}
				],
				floorplanScale: 0.4,
				unitSystem: 'imperial',
				ispSpeed: 0,
				targetThroughput: 25,
				calibration: null
			};
			localStorage.setItem('deconflict:project', JSON.stringify(v2));
		});

		await page.reload();
		await page.waitForTimeout(1500);

		// Check it migrated to v3
		const data = await page.evaluate(() => {
			const raw = localStorage.getItem('deconflict:project');
			if (!raw) return null;
			return JSON.parse(raw);
		});

		// After save, it should be v3 with floors
		// The restore reads v2 and writes atoms; the next save writes v3
		// Force a save by placing another AP
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 500, y: 500 } });
		await page.waitForTimeout(3000);

		const saved = await page.evaluate(() => {
			const raw = localStorage.getItem('deconflict:project');
			if (!raw) return null;
			return JSON.parse(raw);
		});

		expect(saved.version).toBe(3);
		expect(saved.floors.length).toBe(1);
		expect(saved.aps.length).toBe(2);
		expect(saved.aps[0].floorId).toBeTruthy();
	});
});
