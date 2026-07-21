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

const routePoints = async (page: Page): Promise<Array<[number, number]>> => {
	const pathData: string = await page.locator("#wb-veszprem-wayfinding-route [data-route-layer='foreground']").getAttribute('d') ?? '';
	const values: number[] = (pathData.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number);
	const points: Array<[number, number]> = [];

	for (let index = 0; index < values.length; index += 2) points.push([values[index], values[index + 1]]);

	return points;
};

test('the supplied source map is packaged and reaches the ready state', async ({ page }): Promise<void> => {
	await openScenario(page);
	await expect(page.locator('[data-preview-id="veszprem-wayfinding-root"]')).toHaveAttribute('data-map-state', 'ready');
	await expect(page.locator('#map-artwork')).toHaveAttribute('href', /veszprem-map/);
});

test('selecting a destination draws the explicit graph route and details', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /Hősök Kapuja/ }).click();

	await expect(page.locator("#wb-veszprem-wayfinding-route [data-route-layer='foreground']")).toHaveCount(1);
	await expect(page.getByText('APPROX. DISTANCE')).toBeVisible();
	await expect(page.getByText('WALKING TIME')).toBeVisible();
	await expect(page.locator('[data-wayfinding-location-id="hosok-kapuja"]')).toHaveAttribute('data-wb-wayfinding-selected', 'true');
});

test('destination search uses the app-owned multilingual signage keyboard', async ({ page }): Promise<void> => {
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

test('tapping an SVG hit target uses the same routing and metadata path', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.locator('[data-wayfinding-location-id="petofi-szinhaz"]').click({ force: true });

	await expect(page.getByRole('heading', { name: 'Veszprémi Petőfi Színház' })).toBeVisible();
	await expect(page.locator("#wb-veszprem-wayfinding-route [data-route-layer='foreground']")).toHaveCount(1);
});

test('representative destinations render multi-segment routes from the certified graph', async ({ page }): Promise<void> => {
	await openScenario(page);
	const destinationNames = [/Auer House/, /Laczkó Dezső Museum/, /ActiCity Dance/, /Gyárkert Culture Park/];

	for (const destinationName of destinationNames) {
		await page.getByRole('button', { name: destinationName }).click();
		const route = page.locator("#wb-veszprem-wayfinding-route [data-route-layer='foreground']");
		const pathData: string = await route.getAttribute('d') ?? '';

		const values: number[] = (pathData.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number);
		const points: Array<[number, number]> = [];

		for (let index = 0; index < values.length; index += 2) points.push([values[index], values[index + 1]]);
		expect(points.length).toBeGreaterThan(2);
		await page.getByRole('button', { name: 'Clear route' }).click();
	}
});

test('reviewed routes use the correct exits, entrances, crossings, and stairs', async ({ page }): Promise<void> => {
	await openScenario(page);

	await page.locator('[data-wayfinding-location-id="hosok-kapuja"]').click({ force: true });
	let points: Array<[number, number]> = await routePoints(page);
	expect(points[points.length - 1]).toEqual([338, 322]);
	await page.getByRole('button', { name: 'Clear route' }).click();

	await page.locator('[data-wayfinding-location-id="auer-haz"]').click({ force: true });
	points = await routePoints(page);
	expect(points[points.length - 1]).toEqual([480, 365]);
	await page.getByRole('button', { name: 'Clear route' }).click();

	await page.locator('[data-wayfinding-location-id="posa-haz"]').click({ force: true });
	points = await routePoints(page);
	expect(points[points.length - 1]).toEqual([300, 382]);
	await page.getByRole('button', { name: 'Clear route' }).click();

	await page.locator('[data-wayfinding-location-id="code-digitalis-elmenykozpont"]').click({ force: true });
	points = await routePoints(page);
	expect(points[points.length - 1]).toEqual([255, 545]);
	await page.getByRole('button', { name: 'Clear route' }).click();

	await page.locator('[data-wayfinding-location-id="petofi-szinhaz"]').click({ force: true });
	points = await routePoints(page);
	expect(points.some(([x, y]): boolean => x >= 370 && x <= 375 && y >= 520 && y <= 550)).toBe(true);
	await page.getByRole('button', { name: 'Clear route' }).click();

	await page.locator('[data-wayfinding-location-id="benedek-hegy"]').click({ force: true });
	points = await routePoints(page);
	expect(points.some(([x, y]): boolean => x >= 108 && x <= 120 && y >= 128 && y <= 165)).toBe(true);
});

test('map hit targets stay visually quiet until hover or selection', async ({ page }): Promise<void> => {
	await openScenario(page);
	const target = page.locator('[data-wayfinding-location-id="hosok-kapuja"]');
	const idleStyle = await target.evaluate((element: Element): { fillOpacity: string; strokeWidth: string } => ({
		fillOpacity: getComputedStyle(element).fillOpacity,
		strokeWidth: getComputedStyle(element).strokeWidth
	}));

	expect(idleStyle.fillOpacity).toBe('0');
	expect(idleStyle.strokeWidth).toBe('0px');
	await target.click({ force: true });
	const selectedStyle = await target.evaluate((element: Element): { fillOpacity: string; strokeWidth: string } => ({
		fillOpacity: getComputedStyle(element).fillOpacity,
		strokeWidth: getComputedStyle(element).strokeWidth
	}));
	expect(Number(selectedStyle.fillOpacity)).toBeGreaterThan(0);
	expect(Number.parseFloat(selectedStyle.strokeWidth)).toBeGreaterThan(0);
});

test('fit route restores the complete active path after manual zoom without changing geometry', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.locator('[data-wayfinding-location-id="auer-haz"]').click({ force: true });
	const path = page.locator("#wb-veszprem-wayfinding-route [data-route-layer='foreground']");
	const beforePath: string | null = await path.getAttribute('d');
	const beforePaint = await path.evaluate((element: Element): { dasharray: string; dashoffset: string } => ({
		dasharray: getComputedStyle(element).strokeDasharray,
		dashoffset: getComputedStyle(element).strokeDashoffset
	}));
	await page.getByRole('button', { name: 'Zoom in' }).click();
	await page.getByRole('button', { name: 'Zoom in' }).click();
	const zoomedViewBox: string | null = await page.locator('#map-artwork').evaluate((element: Element): string | null => (element as SVGElement).ownerSVGElement?.getAttribute('viewBox') ?? null);
	await page.getByRole('button', { name: 'Fit route' }).click();
	const fittedViewBox: string | null = await page.locator('#map-artwork').evaluate((element: Element): string | null => (element as SVGElement).ownerSVGElement?.getAttribute('viewBox') ?? null);

	expect(fittedViewBox).not.toBe(zoomedViewBox);
	expect(await path.getAttribute('d')).toBe(beforePath);
	expect(beforePaint.dasharray).toBe('none');
	expect(beforePaint.dashoffset).toBe('0px');
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCSS('opacity', '1');
});

test('every mapped destination keeps one complete solid route while zoomed', async ({ page }): Promise<void> => {
	await openScenario(page);
	const targetIds: string[] = await page.locator('[data-destination-id][data-routeable="true"]').evaluateAll((elements: Element[]): string[] => {
		return elements
			.map((element: Element): string => element.getAttribute('data-destination-id') ?? '')
			.filter((id: string): boolean => id.length > 0 && id !== 'tourinform-veszprem');
	});

	expect(targetIds.length).toBeGreaterThan(30);

	for (const targetId of targetIds) {
		await page.locator(`[data-destination-id="${targetId}"]`).evaluate((element: HTMLElement): void => {
			element.click();
		});
		await page.getByRole('button', { name: 'Zoom in' }).click();
		await page.getByRole('button', { name: 'Zoom in' }).click();
		const group = page.locator('#wb-veszprem-wayfinding-route');
		const foreground = group.locator("[data-route-layer='foreground']");
		const underlay = group.locator("[data-route-layer='underlay']");

		await expect(group, `${targetId} route group`).toHaveCSS('opacity', '1');
		await expect(foreground, `${targetId} foreground`).toHaveCount(1);
		await expect(underlay, `${targetId} underlay`).toHaveCount(1);
		expect(await foreground.getAttribute('d'), `${targetId} foreground and underlay geometry`).toBe(await underlay.getAttribute('d'));
		const paint = await foreground.evaluate((element: SVGPathElement): { dasharray: string; dashoffset: string; length: number } => ({
			dasharray: getComputedStyle(element).strokeDasharray,
			dashoffset: getComputedStyle(element).strokeDashoffset,
			length: element.getTotalLength()
		}));

		expect(paint.dasharray, `${targetId} dash array`).toBe('none');
		expect(paint.dashoffset, `${targetId} dash offset`).toBe('0px');
		expect(paint.length, `${targetId} route length`).toBeGreaterThan(0);
		await page.getByRole('button', { name: 'Clear route' }).click();
	}
});

test('the language selector switches all app-owned interface labels', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: 'HU', exact: true }).click();

	await expect(page.getByRole('heading', { name: 'Hová szeretne menni?' })).toBeVisible();
	await expect(page.getByRole('searchbox', { name: 'Helyszín keresése' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Alaphelyzet' })).toBeVisible();
	await expect(page.getByText('Érintsen meg egy kiemelt helyszínt')).toBeVisible();
});

test('the destination directory scrolls continuously without pagination', async ({ page }): Promise<void> => {
	await openScenario(page);
	const list = page.locator('[data-destination-count="36"]');
	const dimensions = await list.evaluate((element: Element): { clientHeight: number; scrollHeight: number } => ({
		clientHeight: (element as HTMLElement).clientHeight,
		scrollHeight: (element as HTMLElement).scrollHeight
	}));

	expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
	await list.evaluate((element: Element): void => { (element as HTMLElement).scrollTop = (element as HTMLElement).scrollHeight; });
	await expect(page.getByRole('button', { name: /Veszprém Sports Swimming Pool/ })).toBeVisible();
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
	await page.mouse.move(bounds!.x + bounds!.width * 0.40, bounds!.y + bounds!.height * 0.48, { steps: 6 });
	await page.mouse.up();
	const after: string | null = await artwork.evaluate((element: Element): string | null => (element as SVGElement).ownerSVGElement?.getAttribute('viewBox') ?? null);

	expect(after).not.toBe(before);
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(0);
});

test('off-map destinations remain selectable without inventing a route', async ({ page }): Promise<void> => {
	await openScenario(page, 'external-destination');
	await page.getByRole('button', { name: /Veszprém Aréna Sport- és Rendezvénycsarnok/ }).click();

	await expect(page.getByText('Listed outside the downtown route map')).toBeVisible();
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(0);
});

test('the app-owned Hungarian keyboard filters destinations without the OS keyboard', async ({ page }): Promise<void> => {
	await openScenario(page);
	const search = page.getByRole('searchbox', { name: 'Search destinations' });

	await expect(search).toHaveAttribute('inputmode', 'none');
	await page.getByRole('button', { name: 'Open touch keyboard' }).click();
	const keyboard = page.getByRole('dialog', { name: 'Search destinations' });
	await expect(keyboard).toBeVisible();
	await keyboard.getByRole('button', { name: 'Key h', exact: true }).click();
	await keyboard.getByRole('button', { name: 'Key ő', exact: true }).click();
	await expect(search).toHaveValue('hő');
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

	await expect(page.getByRole('button', { name: /Live gateway/ })).toBeVisible();
});

test('reset clears route, filters, and map zoom after keyboard use', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /Hősök Kapuja/ }).click();
	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(1);
	await page.getByRole('button', { name: 'Clear route' }).click();

	await page.getByRole('button', { name: 'Zoom in' }).click();
	await page.getByRole('button', { name: 'Open touch keyboard' }).click();
	const keyboard = page.getByRole('dialog', { name: 'Search destinations' });
	await keyboard.getByRole('button', { name: 'Key v', exact: true }).click();
	await keyboard.getByRole('button', { name: 'Close', exact: true }).click();
	await page.getByRole('button', { name: 'Reset' }).click();

	await expect(page.locator('#wb-veszprem-wayfinding-route')).toHaveCount(0);
	await expect(page.getByLabel('Search destinations')).toHaveValue('');
	await expect(keyboard).toHaveCount(0);
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
