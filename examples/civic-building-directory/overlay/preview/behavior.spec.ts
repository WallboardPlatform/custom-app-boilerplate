import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: { pushDatasource: (property: string, value: unknown) => void };
}

const openScenario = async (page: Page, scenario = 'app-default'): Promise<void> => {
	await page.setViewportSize({ width: 1366, height: 768 });
	const response = await page.goto(`/preview/widget.html?scenario=${scenario}&background=light`);
	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await expect(page.locator('[data-preview-id="civic-building-directory-root"]')).toBeVisible();
};

test('all three semantic floor maps are available and floor controls switch without changing selection', async ({ page }): Promise<void> => {
	await openScenario(page);
	const root = page.locator('[data-preview-id="civic-building-directory-root"]');
	await expect(root).toHaveAttribute('data-active-floor', '1');
	await expect(page.locator('[data-wayfinding-level="1"]')).toBeVisible();
	await page.getByRole('tab', { name: 'Level 2' }).click();
	await expect(root).toHaveAttribute('data-active-floor', '2');
	await expect(page.locator('[data-wayfinding-level="2"]')).toBeVisible();
	await page.getByRole('tab', { name: 'Level 3' }).click();
	await expect(root).toHaveAttribute('data-active-floor', '3');
	await expect(page.locator('[data-wayfinding-level="3"]')).toBeVisible();
});

test('selecting a same-floor destination adds a dedicated pulse without drawing a route', async ({ page }): Promise<void> => {
	await openScenario(page, 'active-highlight');
	await page.getByRole('button', { name: /Utility Billing/ }).click();
	await expect(page.locator('#wb-civic-directory-guidance')).toHaveCount(1);
	await expect(page.locator('#wb-civic-directory-guidance .wb-civic-target-pulse')).toHaveCount(1);
	await expect(page.locator('path[data-route], polyline[data-route]')).toHaveCount(0);
	await expect(page.getByText('Highlighted on Level 1')).toBeVisible();
});

test('reviewed same-floor guidance draws a route on the authored circulation spine', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /Utility Billing/ }).click();
	await expect(page.locator('polyline[data-route="1"]')).toHaveCount(2);
	await expect(page.locator('[data-route-summary]')).toContainText('Route shown from the main lobby');
	await expect(page.locator('[data-route-summary]')).toContainText('Approx. distance');
});

test('cross-floor selection does not move the visitor and requires an explicit floor change', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /Council Office/ }).click();
	const root = page.locator('[data-preview-id="civic-building-directory-root"]');
	await expect(root).toHaveAttribute('data-active-floor', '1');
	await expect(page.locator('polyline[data-route="1"]')).toHaveCount(2);
	await expect(page.getByText('Follow the route to the central elevator, then continue on the destination level.')).toBeVisible();
	await page.getByRole('button', { name: 'View Level 3' }).click();
	await expect(root).toHaveAttribute('data-active-floor', '3');
	await expect(page.locator('polyline[data-route="3"]')).toHaveCount(2);
	await expect(page.locator('#wb-civic-directory-guidance .wb-civic-target-pulse')).toHaveCount(1);
});

test('selection never changes a manually zoomed viewport', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: 'Zoom in' }).click();
	const svg = page.locator('[aria-label="Building map"] svg');
	const before: string | null = await svg.getAttribute('viewBox');
	await page.getByRole('button', { name: /Utility Billing/ }).click();
	expect(await svg.getAttribute('viewBox')).toBe(before);
	await expect(page.locator('[data-preview-id="civic-building-directory-root"]')).toHaveAttribute('data-map-zoom', '1.25');
});

test('current position is persistent on Level 1 and separate from selected target', async ({ page }): Promise<void> => {
	await openScenario(page);
	await expect(page.locator('[data-start-location-id="main-lobby"]')).toBeVisible();
	await page.getByRole('button', { name: /Court Services/ }).click();
	await expect(page.locator('[data-start-location-id="main-lobby"] .wb-civic-current-pulse')).toHaveCount(1);
	await expect(page.locator('#wb-civic-directory-guidance .wb-civic-target-pulse')).toHaveCount(1);
});

test('the app-owned keyboard exposes English and Spanish layouts and filters the directory', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: 'Open touch keyboard' }).click();
	const keyboard = page.getByRole('dialog', { name: 'Search destinations' });
	await expect(keyboard).toBeVisible();
	await expect(keyboard.getByRole('button', { name: 'EN', exact: true })).toBeVisible();
	await expect(keyboard.getByRole('button', { name: 'ES', exact: true })).toBeVisible();
	await keyboard.getByRole('button', { name: 'Key u' }).click();
	await keyboard.getByRole('button', { name: 'Show results' }).click();
	await expect(page.getByRole('searchbox', { name: 'Search destinations' })).toHaveValue('u');
});

test('interface language switch changes app-owned search and floor copy', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: 'ES', exact: true }).click();
	await expect(page.getByRole('heading', { name: '¿A dónde desea ir?' })).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Buscar destinos' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Reiniciar' })).toBeVisible();
});

test('bound empty data remains empty and a live TABLE update replaces it', async ({ page }): Promise<void> => {
	await openScenario(page, 'empty');
	await expect(page.getByText('No destinations are available.')).toBeVisible();
	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushDatasource('destinationData', {
			Destinations: { rows: [{
				id: 'main-lobby', name: 'Live Welcome Desk', alternateName: '', mapLabel: 'Welcome Desk', floor: '1',
				category: 'Visitor services', description: 'Updated in place.', hours: '', status: '', keywords: '', accessible: true
			}] }
		});
	});
	await expect(page.getByRole('button', { name: /Live Welcome Desk/ })).toBeVisible();
});

test('reset clears selection, query, floor, and zoom', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('tab', { name: 'Level 2' }).click();
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await page.getByRole('button', { name: /Engineering/ }).click();
	await page.getByRole('button', { name: 'Reset' }).click();
	const root = page.locator('[data-preview-id="civic-building-directory-root"]');
	await expect(root).toHaveAttribute('data-active-floor', '1');
	await expect(root).toHaveAttribute('data-map-zoom', '1');
	await expect(page.getByRole('heading', { name: 'Where can we help you go?' })).toBeVisible();
});

test('idle reset returns a shared kiosk session to the configured initial state', async ({ page }): Promise<void> => {
	await page.clock.install({ time: new Date('2026-07-21T12:00:00Z') });
	await openScenario(page);
	await page.getByRole('button', { name: /Utility Billing/ }).click();
	await expect(page.locator('#wb-civic-directory-guidance')).toHaveCount(1);
	await page.clock.fastForward(60_000);
	await expect(page.locator('#wb-civic-directory-guidance')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Where can we help you go?' })).toBeVisible();
});
