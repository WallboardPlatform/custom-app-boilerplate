import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const openApp = async (page: Page): Promise<void> => {
	await page.setViewportSize({ width: 1440, height: 900 });
	const response = await page.goto('/preview/widget.html?background=light');
	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError));
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

test('renders a nonblank WebGL scene from the Studio runtime artifact', async ({ page }): Promise<void> => {
	await openApp(page);
	const root = page.locator('[data-preview-id="spatial-wayfinding-root"]');
	await expect(root).toHaveAttribute('data-runtime-project', 'northline-spatial-wayfinding');
	await expect(root).toHaveAttribute('data-view', '3d');
	const canvas = root.locator('canvas');
	await expect(canvas).toBeVisible();
	const dataUrlLength: number = await canvas.evaluate((element: HTMLCanvasElement): number => element.toDataURL('image/png').length);
	expect(dataUrlLength).toBeGreaterThan(8_000);
});

test('selects destinations and renders the same route in 3D and 2D', async ({ page }): Promise<void> => {
	await openApp(page);
	const root = page.locator('[data-preview-id="spatial-wayfinding-root"]');
	await page.getByRole('button', { name: 'The Forum' }).click();
	await expect(root).toHaveAttribute('data-selected-destination', 'forum');
	await expect(page.locator('.wb-spatial-wayfinding-details h3')).toHaveText('The Forum');
	await page.getByRole('button', { name: '2D', exact: true }).click();
	await expect(root).toHaveAttribute('data-view', '2d');
	await expect(page.locator('.wb-spatial-wayfinding-route')).toBeVisible();
	await expect(page.locator('.wb-spatial-wayfinding-zone.wb-spatial-wayfinding-selected')).toHaveCount(1);
});

test('resets selection and camera without destroying the scene', async ({ page }): Promise<void> => {
	await openApp(page);
	const root = page.locator('[data-preview-id="spatial-wayfinding-root"]');
	await page.getByRole('button', { name: 'Campus Cafe' }).click();
	await expect(root).toHaveAttribute('data-selected-destination', 'campus-cafe');
	await page.getByRole('button', { name: 'Reset view' }).click();
	await expect(root).toHaveAttribute('data-selected-destination', '');
	await expect(root.locator('canvas')).toBeVisible();
});
