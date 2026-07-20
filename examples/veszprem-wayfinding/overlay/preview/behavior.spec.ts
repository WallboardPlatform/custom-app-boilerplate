import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		pushDatasource: (property: string, value: unknown) => void;
	};
}

const openScenario = async (page: Page, scenario = 'app-default'): Promise<void> => {
	await page.setViewportSize(scenario === 'active-route' ? { width: 1920, height: 1080 } : { width: 1366, height: 768 });
	const response = await page.goto(`/preview/widget.html?scenario=${scenario}&background=light`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await expect(page.locator('[data-preview-id="veszprem-wayfinding-root"]')).toBeVisible();
};

test('selecting a destination draws a connected shortest path and route details', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: 'Hangvilla Multifunkcionális Közösségi Tér' }).click();

	await expect(page.locator('#wb-veszprem-wayfinding-route path')).toHaveCount(1);
	await expect(page.getByText('APPROX. DISTANCE')).toBeVisible();
	await expect(page.getByText('WALKING TIME')).toBeVisible();
	await expect(page.locator('#Level0-Locations #hangvilla')).toHaveAttribute('data-wb-wayfinding-selected', 'true');
});

test('destination search uses the app-owned multilingual signage keyboard', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByLabel('Search destinations').click();
	const keyboard = page.getByRole('dialog', { name: 'Search destinations' });

	await expect(keyboard).toBeVisible();
	await expect(keyboard.getByRole('button', { name: 'HU' })).toHaveAttribute('aria-pressed', 'true');
	await keyboard.getByRole('button', { name: 'Key v' }).click();
	await expect(page.getByRole('searchbox', { name: 'Search destinations' })).toHaveValue('v');
	await keyboard.getByRole('button', { name: 'Show results' }).click();
	await expect(keyboard).toHaveCount(0);
});

test('tapping a mapped location uses the same routing path as the directory', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.locator('#Level0-Locations #petofi-szinhaz').click({ force: true });

	await expect(page.getByRole('heading', { name: 'Veszprémi Petőfi Színház' })).toBeVisible();
	await expect(page.locator('#wb-veszprem-wayfinding-route path')).toHaveCount(1);
});

test('off-map destinations remain selectable without inventing a route', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: 'Veszprém Aréna Sport- és Rendezvénycsarnok' }).click();

	await expect(page.getByText('Outside the downtown walking map')).toBeVisible();
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(0);
});

test('bound empty data stays empty and live table updates replace it', async ({ page }): Promise<void> => {
	await openScenario(page, 'empty');
	await expect(page.getByText('No destinations are available.')).toBeVisible();

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushDatasource('destinationData', {
			Destinations: {
				rows: [{ id: 'hosok-kapuja', name: 'Live Visitor Gateway', englishName: 'Live gateway', category: 'Live update', description: 'Updated in place.', accessible: true, routeable: true }]
			}
		});
	});

	await expect(page.getByRole('button', { name: 'Live Visitor Gateway Live gateway' })).toBeVisible();
});

test('route reset returns the kiosk to the destination list', async ({ page }): Promise<void> => {
	await page.clock.install({ time: new Date('2026-07-17T12:00:00Z') });
	await openScenario(page);
	await page.getByRole('button', { name: 'Hangvilla Multifunkcionális Közösségi Tér' }).click();
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(1);

	await page.clock.fastForward(45_000);
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Hangvilla Multifunkcionális Közösségi Tér' })).toBeVisible();
});
