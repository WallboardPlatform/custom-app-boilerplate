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
	await expect(page.locator('[data-preview-id="veszprem-wayfinding-root"]')).toBeVisible();
};

test('the supplied map loads and default selection highlights one destination without inventing a route', async ({ page }): Promise<void> => {
	await openScenario(page);
	await expect(page.locator('[data-preview-id="veszprem-wayfinding-root"]')).toHaveAttribute('data-map-state', 'ready');
	await page.locator('[data-destination-id="hosok-kapuja"]').click();

	const root = page.locator('[data-preview-id="veszprem-wayfinding-root"]');
	await expect(root).toHaveAttribute('data-guidance-mode', 'highlight');
	await expect(root).toHaveAttribute('data-guidance-state', 'highlight');
	await expect(page.locator('#wb-veszprem-wayfinding-guidance')).toHaveCount(1);
	await expect(page.locator("#wb-veszprem-wayfinding-guidance [data-guidance-layer='target']")).toHaveCount(1);
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(0);
	await expect(page.getByText('Highlighted on the map')).toBeVisible();
});

test('directional mode shows two anchors and a compass cue but no path line', async ({ page }): Promise<void> => {
	await openScenario(page, 'directional-guidance');
	await page.locator('[data-destination-id="hosok-kapuja"]').click();

	const root = page.locator('[data-preview-id="veszprem-wayfinding-root"]');
	await expect(root).toHaveAttribute('data-guidance-state', 'directional');
	await expect(page.locator("#wb-veszprem-wayfinding-guidance [data-guidance-layer='origin']")).toHaveCount(1);
	await expect(page.locator("#wb-veszprem-wayfinding-guidance path")).toHaveCount(0);
	await expect(page.getByText(/Visual direction only - not a walking path/)).toBeVisible();
});

test('map hit areas remain invisible while the selected target gets a dedicated spotlight', async ({ page }): Promise<void> => {
	await openScenario(page);
	const target = page.locator('[data-wayfinding-location-id="hosok-kapuja"]');
	const idleStyle = await target.evaluate((element: Element): { fillOpacity: string; strokeWidth: string } => ({
		fillOpacity: getComputedStyle(element).fillOpacity,
		strokeWidth: getComputedStyle(element).strokeWidth
	}));

	expect(idleStyle.fillOpacity).toBe('0');
	expect(idleStyle.strokeWidth).toBe('0px');
	await target.click({ force: true });
	await expect(page.locator("#wb-veszprem-wayfinding-guidance [data-guidance-layer='shade']")).toHaveCount(1);
	expect(await page.locator('[data-wb-wayfinding-selected]').count()).toBe(0);
});

test('the app-owned keyboard is multilingual and filters the continuous directory', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByLabel('Search destinations').click();
	const keyboard = page.getByRole('dialog', { name: 'Search destinations' });

	await expect(keyboard).toBeVisible();
	await expect(keyboard.getByRole('button', { name: 'HU', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await keyboard.getByRole('button', { name: 'Key v' }).click();
	await expect(page.getByRole('searchbox', { name: 'Search destinations' })).toHaveValue('v');
	await keyboard.getByRole('button', { name: 'Show results' }).click();
	await expect(keyboard).toHaveCount(0);
});

test('the language selector switches all app-owned interface labels', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: 'HU', exact: true }).click();

	await expect(page.getByRole('heading', { name: 'Hová szeretne menni?' })).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Helyszín keresése' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Alaphelyzet' })).toBeVisible();
});

test('the destination directory scrolls without pagination', async ({ page }): Promise<void> => {
	await openScenario(page);
	const list = page.locator('[data-destination-count="36"]');
	const dimensions = await list.evaluate((element: Element): { clientHeight: number; scrollHeight: number } => ({
		clientHeight: (element as HTMLElement).clientHeight,
		scrollHeight: (element as HTMLElement).scrollHeight
	}));

	expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
	await list.evaluate((element: Element): void => { (element as HTMLElement).scrollTop = (element as HTMLElement).scrollHeight; });
	await expect(page.locator('[data-destination-id="veszpremi-sportuszoda"]')).toBeVisible();
});

test('dragging a zoomed map pans without selecting a destination', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: 'Zoom in' }).click();
	const artwork = page.locator('#map-artwork');
	const before: string | null = await artwork.evaluate((element: Element): string | null => (element as SVGElement).ownerSVGElement?.getAttribute('viewBox') ?? null);
	const bounds = await artwork.boundingBox();

	expect(bounds).not.toBeNull();
	await page.mouse.move(bounds!.x + bounds!.width * 0.55, bounds!.y + bounds!.height * 0.55);
	await page.mouse.down();
	await page.mouse.move(bounds!.x + bounds!.width * 0.4, bounds!.y + bounds!.height * 0.48, { steps: 6 });
	await page.mouse.up();
	const after: string | null = await artwork.evaluate((element: Element): string | null => (element as SVGElement).ownerSVGElement?.getAttribute('viewBox') ?? null);

	expect(after).not.toBe(before);
	await expect(page.locator('#wb-veszprem-wayfinding-guidance')).toHaveCount(0);
});

test('off-map destinations remain selectable without map geometry', async ({ page }): Promise<void> => {
	await openScenario(page, 'external-destination');
	await page.getByRole('button', { name: /Future Visitor Centre/ }).click();

	await expect(page.getByText('Not shown on this map')).toBeVisible();
	await expect(page.locator('#wb-veszprem-wayfinding-guidance')).toHaveCount(0);
});

test('bound empty data stays empty and live table updates replace it', async ({ page }): Promise<void> => {
	await openScenario(page, 'empty');
	await expect(page.getByText('No destinations are available.')).toBeVisible();

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushDatasource('destinationData', {
			Destinations: { rows: [{
				accessible: null,
				category: 'Live update',
				description: 'Updated in place.',
				englishName: 'Live gateway',
				hours: '',
				id: 'tourinform-veszprem',
				mapNumber: 'START',
				name: 'Live Visitor Gateway',
				status: ''
			}] }
		});
	});

	await expect(page.getByRole('button', { name: /Live gateway/ })).toBeVisible();
});

test('reset clears guidance, filters, keyboard, and map zoom', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.locator('[data-destination-id="hosok-kapuja"]').click();
	await page.getByRole('button', { name: 'Clear selection' }).click();
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await page.getByRole('button', { name: 'Open touch keyboard' }).click();
	const keyboard = page.getByRole('dialog', { name: 'Search destinations' });
	await keyboard.getByRole('button', { name: 'Key v' }).click();
	await keyboard.getByRole('button', { name: 'Close', exact: true }).click();
	await page.getByRole('button', { name: 'Reset' }).click();

	await expect(page.locator('#wb-veszprem-wayfinding-guidance')).toHaveCount(0);
	await expect(page.getByLabel('Search destinations')).toHaveValue('');
	await expect(page.getByRole('dialog', { name: 'Search destinations' })).toHaveCount(0);
	await expect(page.locator('[data-preview-id="veszprem-wayfinding-root"]')).toHaveAttribute('data-map-zoom', '1');
});

test('selection reset returns the kiosk to the destination list', async ({ page }): Promise<void> => {
	await page.clock.install({ time: new Date('2026-07-17T12:00:00Z') });
	await openScenario(page);
	await page.locator('[data-destination-id="hosok-kapuja"]').click();
	await expect(page.locator('#wb-veszprem-wayfinding-guidance')).toHaveCount(1);

	await page.clock.fastForward(45_000);
	await expect(page.locator('#wb-veszprem-wayfinding-guidance')).toHaveCount(0);
	await expect(page.locator('[data-destination-id="hosok-kapuja"]')).toBeVisible();
});
