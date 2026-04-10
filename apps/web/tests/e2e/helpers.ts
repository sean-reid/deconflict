import type { Page } from '@playwright/test';

/** Dismiss welcome dialog and clear saved state for a clean test */
export async function setupCleanState(page: Page): Promise<void> {
	await page.addInitScript(() => {
		localStorage.setItem('deconflict:welcomed', '1');
		localStorage.removeItem('deconflict:project');
	});
}
