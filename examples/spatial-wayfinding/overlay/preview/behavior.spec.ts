import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const openApp = async (page: Page): Promise<void> => {
	await page.setViewportSize({ width: 1440, height: 900 });
	const response = await page.goto('/preview/widget.html?background=light');
	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError));
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

test('loads the published map package and renders a nonblank WebGL scene', async ({ page }): Promise<void> => {
	await openApp(page);
	const root = page.locator('[data-preview-id="spatial-wayfinding-root"]');
	await expect(root).toHaveAttribute('data-runtime-project', 'northline-spatial-wayfinding');
	await expect(root).toHaveAttribute('data-runtime-source', 'wbmap');
	await expect(root).toHaveAttribute('data-view', '3d');
	const canvas = root.locator('canvas');
	await expect(canvas).toBeVisible();
	const dataUrlLength: number = await canvas.evaluate((element: HTMLCanvasElement): number => element.toDataURL('image/png').length);
	expect(dataUrlLength).toBeGreaterThan(8_000);
});

test('shows destination media, metadata, and a route in both map views', async ({ page }): Promise<void> => {
	await openApp(page);
	const root = page.locator('[data-preview-id="spatial-wayfinding-root"]');
	await page.getByRole('button', { name: 'The Forum' }).click();
	await expect(root).toHaveAttribute('data-selected-destination', 'forum');
	await expect(page.locator('.wb-spatial-wayfinding-details h3')).toHaveText('The Forum');
	await expect(page.locator('.wb-spatial-wayfinding-details img')).toBeVisible();
	await expect(page.locator('.wb-spatial-wayfinding-status')).toHaveText('Next event 18:30');
	await expect(page.locator('.wb-spatial-wayfinding-details')).toContainText('Event access only');
	await page.getByRole('button', { name: '2D', exact: true }).click();
	await expect(root).toHaveAttribute('data-view', '2d');
	await expect(page.locator('.wb-spatial-wayfinding-route')).toBeVisible();
	await expect(page.locator('.wb-spatial-wayfinding-zone.wb-spatial-wayfinding-selected')).toHaveCount(1);
	await expect(page.locator('.wb-spatial-wayfinding-target-pulse')).toBeVisible();
});

test('filters the directory, switches language, and controls map layers', async ({ page }): Promise<void> => {
	await openApp(page);
	await page.getByRole('button', { name: '2D', exact: true }).click();
	await page.getByLabel('Category').selectOption('Learning');
	await expect(page.locator('.wb-spatial-wayfinding-destination')).toHaveCount(2);
	await page.getByLabel('Search destinations').fill('studio');
	await expect(page.locator('.wb-spatial-wayfinding-destination')).toHaveCount(1);
	await expect(page.locator('.wb-spatial-wayfinding-destination strong')).toHaveText('Design Studio');
	await page.getByLabel('Language').selectOption('hu');
	await expect(page.locator('.wb-spatial-wayfinding-destination strong')).toHaveText('Designstúdió');
	await expect(page.locator('.wb-spatial-wayfinding-map-label')).not.toHaveCount(0);
	await page.getByRole('button', { name: 'Labels', exact: true }).click();
	await expect(page.locator('.wb-spatial-wayfinding-map-label')).toHaveCount(0);
	await page.getByRole('button', { name: 'Symbols', exact: true }).click();
	await expect(page.locator('.wb-spatial-wayfinding-media[data-media-role="symbol"]')).toHaveCount(0);
	await expect(page.locator('.wb-spatial-wayfinding-media[data-media-role="brand"]')).toHaveCount(1);
});

test('keeps idle floor regions quiet and emphasizes only the selected destination', async ({ page }): Promise<void> => {
	await openApp(page);
	await page.getByRole('button', { name: '2D', exact: true }).click();
	const idleZone = page.locator('.wb-spatial-wayfinding-destination-zone').first();
	await expect(idleZone).toHaveCSS('fill-opacity', '0');
	await page.getByRole('button', { name: 'Campus Cafe' }).click();
	const selectedZone = page.locator('.wb-spatial-wayfinding-zone.wb-spatial-wayfinding-selected');
	await expect(selectedZone).toHaveCount(1);
	await expect(selectedZone).toHaveCSS('fill-opacity', '0.26');
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
