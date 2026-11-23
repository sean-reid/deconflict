import { test, expect, type Page } from '@playwright/test';
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
		const matPicker = page.locator('.row-bottom');
		await expect(matPicker).toBeVisible();
		await expect(matPicker.locator('.mat-chip')).toHaveCount(6);

		await page.screenshot({ path: 'test-results/wall-edit/material-paint-mode.png' });

		// Done
		await page.locator('.wall-toolbar').locator('text=Done').click();
	});

	test('full sequence: edit walls → paint material → place APs → re-edit', async ({ page }) => {
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

/** RGBA of the canvas pixel at a position relative to the canvas (CSS px). */
async function canvasPixel(page: Page, x: number, y: number): Promise<number[]> {
	return page.evaluate(
		({ px, py }) => {
			const c = document.querySelector('canvas') as HTMLCanvasElement;
			const dpr = c.width / c.clientWidth;
			const ctx = c.getContext('2d')!;
			return Array.from(ctx.getImageData(Math.round(px * dpr), Math.round(py * dpr), 1, 1).data);
		},
		{ px: x, py: y }
	);
}

async function startFromScratch(page: Page): Promise<void> {
	await setupCleanState(page);
	await page.goto('/');
	await page.waitForSelector('canvas');
	await page.getByRole('tab', { name: 'Floorplan' }).click();
	await page.getByText('Draw from Scratch').click();
	await expect(page.locator('.wall-toolbar')).toBeVisible();
	await page.waitForTimeout(300);
}

test.describe('Wall shape tools', () => {
	const A = { x: 300, y: 200 };
	const B = { x: 500, y: 200 };
	const MID = { x: 400, y: 200 };
	const OFF = { x: 400, y: 230 };

	test('line tool draws a straight wall with two clicks', async ({ page }) => {
		await startFromScratch(page);
		const canvas = page.locator('canvas');
		const midBefore = await canvasPixel(page, MID.x, MID.y);
		const offBefore = await canvasPixel(page, OFF.x, OFF.y);
		await canvas.click({ position: A });
		await canvas.click({ position: B });
		await page.locator('.wall-toolbar').locator('text=Done').click();
		await page.waitForTimeout(300);
		expect(await canvasPixel(page, MID.x, MID.y)).not.toEqual(midBefore);
		expect(await canvasPixel(page, OFF.x, OFF.y)).toEqual(offBefore);
	});

	test('hovering after the first click previews the line', async ({ page }) => {
		await startFromScratch(page);
		const canvas = page.locator('canvas');
		const midBefore = await canvasPixel(page, MID.x, MID.y);
		await canvas.click({ position: A });
		await canvas.hover({ position: B });
		await page.waitForTimeout(200);
		expect(await canvasPixel(page, MID.x, MID.y)).not.toEqual(midBefore);
	});

	test('escape drops the pending first point', async ({ page }) => {
		await startFromScratch(page);
		const canvas = page.locator('canvas');
		const midBefore = await canvasPixel(page, MID.x, MID.y);
		await canvas.click({ position: A });
		await page.keyboard.press('Escape');
		await canvas.click({ position: B });
		await page.locator('.wall-toolbar').locator('text=Done').click();
		await page.waitForTimeout(300);
		expect(await canvasPixel(page, MID.x, MID.y)).toEqual(midBefore);
	});

	test('ctrl+z undoes the last line inside wall mode', async ({ page }) => {
		await startFromScratch(page);
		const canvas = page.locator('canvas');
		const midBefore = await canvasPixel(page, MID.x, MID.y);
		await canvas.click({ position: A });
		await canvas.click({ position: B });
		await page.keyboard.press('Control+z');
		await page.locator('.wall-toolbar').locator('text=Done').click();
		await page.waitForTimeout(300);
		expect(await canvasPixel(page, MID.x, MID.y)).toEqual(midBefore);
	});
});

test.describe('Wall shape tools (touch)', () => {
	test.use({ hasTouch: true });

	test('touch taps draw a line', async ({ page }) => {
		await startFromScratch(page);
		const box = (await page.locator('canvas').boundingBox())!;
		const midBefore = await canvasPixel(page, 400, 200);
		await page.touchscreen.tap(box.x + 300, box.y + 200);
		await page.touchscreen.tap(box.x + 500, box.y + 200);
		await page.locator('.wall-toolbar').locator('text=Done').click();
		await page.waitForTimeout(300);
		expect(await canvasPixel(page, 400, 200)).not.toEqual(midBefore);
	});
});
