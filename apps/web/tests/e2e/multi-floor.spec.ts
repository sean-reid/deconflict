import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('deconflict:welcomed', '1'));
	await page.goto('http://localhost:4183');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(500);
});

/** Ensure sidebar is open on the Floorplan tab. */
async function openFloorplanTab(page: any) {
	// Already visible?
	if (await page.locator('.floor-strip').isVisible({ timeout: 200 }).catch(() => false)) return;

	// Check if sidebar is open (the aside element exists in DOM)
	const sidebarVisible = await page.locator('aside[aria-label="Sidebar"]').isVisible({ timeout: 200 }).catch(() => false);

	if (!sidebarVisible) {
		// Sidebar is closed — open it
		await page.locator('button[aria-label="Toggle sidebar"]').click();
		await page.waitForTimeout(500);
	}

	// Now sidebar should be open. Click Floorplan tab.
	const fpTab = page.locator('button[role="tab"]').filter({ hasText: 'Floorplan' });
	await fpTab.waitFor({ state: 'visible', timeout: 3000 });
	await fpTab.click();
	await page.waitForTimeout(300);
}

test.describe('Multi-floor', () => {
	// ─── Data model ──────────────────────────────────────────────

	test('v3 persistence: floors + floorId on APs', async ({ page }) => {
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 400, y: 400 } });
		await page.waitForTimeout(3000);

		const data = await page.evaluate(() => {
			const raw = localStorage.getItem('deconflict:project');
			return raw ? JSON.parse(raw) : null;
		});

		expect(data.version).toBe(3);
		expect(data.floors).toHaveLength(1);
		expect(data.aps[0].floorId).toBe(data.floors[0].id);
	});

	test('v2 migration adds floor and floorId', async ({ page }) => {
		await page.evaluate(() => {
			localStorage.setItem(
				'deconflict:project',
				JSON.stringify({
					version: 2,
					name: 'Legacy',
					band: '5ghz',
					channelWidth: 20,
					regulatoryDomain: 'fcc',
					aps: [
						{
							id: 'a1',
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
				})
			);
		});
		await page.reload();
		await page.waitForTimeout(1500);

		// Trigger save
		const canvas = page.locator('canvas');
		await canvas.click({ position: { x: 500, y: 500 } });
		await page.waitForTimeout(3000);

		const data = await page.evaluate(() => {
			const raw = localStorage.getItem('deconflict:project');
			return raw ? JSON.parse(raw) : null;
		});

		expect(data.version).toBe(3);
		expect(data.floors).toHaveLength(1);
		expect(data.aps[0].floorId).toBeTruthy();
	});

	// ─── Floor management ────────────────────────────────────────

	test('add floor', async ({ page }) => {
		await openFloorplanTab(page);
		await page.locator('.floor-pill.add').click();
		await page.waitForTimeout(300);
		await expect(page.locator('.floor-pill:not(.add)')).toHaveCount(2);
		await page.screenshot({ path: 'test-results/multi-floor/add-floor.png' });
	});

	test('rename floor', async ({ page }) => {
		await openFloorplanTab(page);
		const pill = page.locator('.floor-pill:not(.add)').first();
		await pill.dblclick();
		await page.waitForTimeout(200);
		await page.locator('.floor-name-input').fill('Lobby');
		await page.locator('.floor-name-input').press('Enter');
		await page.waitForTimeout(200);
		await expect(page.locator('.floor-pill:not(.add)').first()).toHaveText(/Lobby/);
	});

	test('delete floor', async ({ page }) => {
		await openFloorplanTab(page);
		await page.locator('.floor-pill.add').click();
		await page.waitForTimeout(300);
		await expect(page.locator('.floor-pill:not(.add)')).toHaveCount(2);

		const del = page.locator('.floor-delete');
		if (await del.isVisible()) await del.click();
		await page.waitForTimeout(300);
		await expect(page.locator('.floor-pill:not(.add)')).toHaveCount(1);
	});

	test('cannot delete last floor', async ({ page }) => {
		await openFloorplanTab(page);
		await expect(page.locator('.floor-delete')).not.toBeVisible();
	});

	// ─── Multi-floor AP placement ────────────────────────────────

	test('APs placed on different floors get different floorIds', async ({ page }) => {
		const canvas = page.locator('canvas');

		// Place AP on floor 1
		await canvas.click({ position: { x: 350, y: 350 } });
		await page.waitForTimeout(500);

		// Switch to floorplan tab, add floor 2
		await openFloorplanTab(page);
		await page.locator('.floor-pill.add').click();
		await page.waitForTimeout(300);

		// Place AP on floor 2
		await canvas.click({ position: { x: 500, y: 400 }, force: true });
		await page.waitForTimeout(500);

		// Add floor 3
		await openFloorplanTab(page);
		await page.locator('.floor-pill.add').click();
		await page.waitForTimeout(300);

		// Place AP on floor 3
		await canvas.click({ position: { x: 400, y: 300 }, force: true });
		await page.waitForTimeout(2000);

		await page.screenshot({ path: 'test-results/multi-floor/three-floors.png' });

		const data = await page.evaluate(() => {
			const raw = localStorage.getItem('deconflict:project');
			return raw ? JSON.parse(raw) : null;
		});

		expect(data.floors).toHaveLength(3);
		expect(data.aps).toHaveLength(3);
		const floorIds = new Set(data.aps.map((ap: any) => ap.floorId));
		expect(floorIds.size).toBe(3);
	});

	test('switch floors preserves floorplan state', async ({ page }) => {
		// Load apartment on floor 1
		await page.click('text=Apartment');
		await page.waitForTimeout(4000);
		const skip = page.locator('text=Skip');
		if (await skip.isVisible({ timeout: 2000 }).catch(() => false)) await skip.click();
		await page.waitForTimeout(500);

		await page.screenshot({ path: 'test-results/multi-floor/apartment-floor1.png' });

		// Add floor 2 (should be empty)
		await openFloorplanTab(page);
		await page.locator('.floor-pill.add').click();
		await page.waitForTimeout(300);

		await page.screenshot({ path: 'test-results/multi-floor/empty-floor2.png' });

		// Switch back to floor 1 (apartment should return)
		await page.locator('.floor-pill:not(.add)').first().click();
		await page.waitForTimeout(500);

		await page.screenshot({ path: 'test-results/multi-floor/back-to-floor1.png' });
	});

	test.skip('heatmap works per floor', async ({ page }) => {
		const canvas = page.locator('canvas');

		// Place 2 APs on floor 1
		await canvas.click({ position: { x: 350, y: 350 } });
		await page.waitForTimeout(300);
		await canvas.click({ position: { x: 550, y: 350 }, force: true });
		await page.waitForTimeout(1500);

		// Enable heatmap
		await page.click('text=Signal heatmap');
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/multi-floor/heatmap-floor1.png' });

		// Add floor 2, place 1 AP
		await openFloorplanTab(page);
		await page.locator('.floor-pill.add').click();
		await page.waitForTimeout(300);
		await canvas.click({ position: { x: 450, y: 400 }, force: true });
		await page.waitForTimeout(1500);
		await page.screenshot({ path: 'test-results/multi-floor/heatmap-floor2.png' });

		// Back to floor 1
		await openFloorplanTab(page);
		await page.locator('.floor-pill:not(.add)').first().click();
		await page.waitForTimeout(500);
		await page.screenshot({ path: 'test-results/multi-floor/heatmap-back-floor1.png' });
	});

	// ─── Persistence ─────────────────────────────────────────────

	test('multi-floor state survives reload', async ({ page }) => {
		await openFloorplanTab(page);
		await page.locator('.floor-pill.add').click();
		await page.waitForTimeout(300);

		// Rename floor 2
		const pill = page.locator('.floor-pill:not(.add)').nth(1);
		await pill.dblclick();
		await page.waitForTimeout(200);
		await page.locator('.floor-name-input').fill('Attic');
		await page.locator('.floor-name-input').press('Enter');
		await page.waitForTimeout(3000);

		await page.reload();
		await page.waitForTimeout(1500);

		await openFloorplanTab(page);
		const pills = page.locator('.floor-pill:not(.add)');
		await expect(pills).toHaveCount(2);
		await expect(pills.nth(1)).toHaveText(/Attic/);
	});
});
