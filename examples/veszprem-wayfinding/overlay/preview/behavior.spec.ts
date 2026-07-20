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

test('the supplied source map is packaged and reaches the ready state', async ({ page }): Promise<void> => {
	await openScenario(page);
	await expect(page.locator('[data-preview-id="veszprem-wayfinding-root"]')).toHaveAttribute('data-map-state', 'ready');
	await expect(page.locator('#map-artwork')).toHaveAttribute('href', /veszprem-map/);
});

test('selecting a destination draws the explicit graph route and details', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /Hősök Kapuja/ }).click();

	await expect(page.locator('#wb-veszprem-wayfinding-route path')).toHaveCount(1);
	await expect(page.getByText('APPROX. DISTANCE')).toBeVisible();
	await expect(page.getByText('WALKING TIME')).toBeVisible();
	await expect(page.locator('[data-wayfinding-location-id="hosok-kapuja"]')).toHaveAttribute('data-wb-wayfinding-selected', 'true');
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

test('tapping an SVG hit target uses the same routing and metadata path', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.locator('[data-wayfinding-location-id="petofi-szinhaz"]').click({ force: true });

	await expect(page.getByRole('heading', { name: 'Veszprémi Petőfi Színház' })).toBeVisible();
	await expect(page.locator('#wb-veszprem-wayfinding-route path')).toHaveCount(1);
});

test('representative routes stay on the reviewed dense corridor network', async ({ page }): Promise<void> => {
	await openScenario(page);
	const routes: Array<{ destinationId: string; waypoints: string[] }> = [
		{ destinationId: 'auer-haz', waypoints: ['L 432 404', 'L 457 384'] },
		{ destinationId: 'laczko-dezso-muzeum', waypoints: ['L 345 553', 'L 334 581', 'L 352 640', 'L 445 640', 'L 510 625'] },
		{ destinationId: 'acticity', waypoints: ['L 345 553', 'L 334 581', 'L 352 640', 'L 448 664'] },
		{ destinationId: 'gyarkert-kulturpark', waypoints: ['L 579 518', 'L 614 520', 'L 649 508'] }
	];

	for (const expected of routes) {
		await page.locator(`[data-wayfinding-location-id="${expected.destinationId}"]`).click({ force: true });
		const route = page.locator('#wb-veszprem-wayfinding-route path');
		const pathData: string = await route.getAttribute('d') ?? '';

		for (const waypoint of expected.waypoints) expect(pathData).toContain(waypoint);

		const values: number[] = (pathData.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number);
		const points: Array<[number, number]> = [];

		for (let index = 0; index < values.length; index += 2) points.push([values[index], values[index + 1]]);

		const longestSegment: number = Math.max(...points.slice(1).map((point: [number, number], index: number): number => {
			const previous: [number, number] = points[index];

			return Math.hypot(point[0] - previous[0], point[1] - previous[1]);
		}));

		expect(longestSegment).toBeLessThanOrEqual(45);
		await page.getByRole('button', { name: 'Clear route' }).click();
	}
});

test('off-map destinations remain selectable without inventing a route', async ({ page }): Promise<void> => {
	await openScenario(page, 'external-destination');
	await page.getByRole('button', { name: /Veszprém Aréna Sport- és Rendezvénycsarnok/ }).click();

	await expect(page.getByText('Listed outside the downtown route map')).toBeVisible();
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(0);
});

test('the app-owned Hungarian keyboard filters destinations without the OS keyboard', async ({ page }): Promise<void> => {
	await openScenario(page);
	const search = page.getByLabel('Search destinations');

	await expect(search).toHaveAttribute('inputmode', 'none');
	await page.getByRole('button', { name: 'Open touch keyboard' }).click();
	await expect(page.locator('[data-preview-keyboard="open"]')).toBeVisible();
	await page.locator('[data-preview-keyboard="open"]').getByRole('button', { name: 'H', exact: true }).click();
	await page.locator('[data-preview-keyboard="open"]').getByRole('button', { name: 'Ő', exact: true }).click();
	await expect(search).toHaveValue('HŐ');
	await expect(page.getByRole('button', { name: /Hősök Kapuja/ })).toBeVisible();
});

test('bound empty data stays empty and live table updates replace it', async ({ page }): Promise<void> => {
	await openScenario(page, 'empty');
	await expect(page.getByText('No destinations are available.')).toBeVisible();

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushDatasource('destinationData', {
			Destinations: {
				rows: [{
					id: 'tourinform-veszprem',
					mapNumber: 'START',
					name: 'Live Visitor Gateway',
					englishName: 'Live gateway',
					category: 'Live update',
					description: 'Updated in place.',
					hours: '',
					status: '',
					accessible: null,
					routeable: true
				}]
			}
		});
	});

	await expect(page.getByRole('button', { name: /Live Visitor Gateway Live gateway/ })).toBeVisible();
});

test('reset clears route, filters, keyboard, and map zoom', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /Hősök Kapuja/ }).click();
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(1);
	await page.getByRole('button', { name: 'Clear route' }).click();

	await page.getByRole('button', { name: 'Open touch keyboard' }).click();
	await page.locator('[data-preview-keyboard="open"]').getByRole('button', { name: 'V', exact: true }).click();
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await page.getByRole('button', { name: 'Reset' }).click();

	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(0);
	await expect(page.getByLabel('Search destinations')).toHaveValue('');
	await expect(page.locator('[data-preview-keyboard="open"]')).toHaveCount(0);
	await expect(page.locator('[data-preview-id="veszprem-wayfinding-root"]')).toHaveAttribute('data-map-zoom', '1');
});

test('route reset returns the kiosk to the destination list', async ({ page }): Promise<void> => {
	await page.clock.install({ time: new Date('2026-07-17T12:00:00Z') });
	await openScenario(page);
	await page.getByRole('button', { name: /Hősök Kapuja/ }).click();
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(1);

	await page.clock.fastForward(45_000);
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Hősök Kapuja/ })).toBeVisible();
});
