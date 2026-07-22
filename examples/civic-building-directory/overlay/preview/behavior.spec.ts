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

const hasImmediateAxisReversal = (points: number[][]): boolean => {
	for (let index = 2; index < points.length; index += 1) {
		const [beforeX, beforeY] = points[index - 2];
		const [previousX, previousY] = points[index - 1];
		const [currentX, currentY] = points[index];
		const reversesHorizontally: boolean = beforeY === previousY && previousY === currentY
			&& Math.sign(previousX - beforeX) * Math.sign(currentX - previousX) < 0;
		const reversesVertically: boolean = beforeX === previousX && previousX === currentX
			&& Math.sign(previousY - beforeY) * Math.sign(currentY - previousY) < 0;

		if (reversesHorizontally || reversesVertically) return true;
	}

	return false;
};

const routePoints = async (page: Page, floor: string): Promise<number[][]> => {
	const route = page.locator(`polyline.wb-civic-route-line[data-route="${floor}"]`);
	await expect(route).toHaveCount(1);

	return (await route.getAttribute('points'))
		?.trim()
		.split(/\s+/)
		.map((point: string): number[] => point.split(',').map(Number)) ?? [];
};

const expectCleanRoute = async (page: Page, floor: string): Promise<void> => {
	const points: number[][] = await routePoints(page, floor);

	expect(points.length).toBeGreaterThan(1);
	for (let index = 1; index < points.length; index += 1) {
		expect(points[index][0] === points[index - 1][0] || points[index][1] === points[index - 1][1]).toBe(true);
	}
	expect(hasImmediateAxisReversal(points)).toBe(false);

	const marker = page.locator('#wb-civic-directory-guidance .wb-civic-target-pulse');
	await expect(marker).toHaveCount(1);
	const last: number[] = points[points.length - 1];
	expect(Number(await marker.getAttribute('cx'))).toBe(last[0]);
	expect(Number(await marker.getAttribute('cy'))).toBe(last[1]);
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

test('routes use orthogonal segments and terminate at the pulsing entrance marker', async ({ page }): Promise<void> => {
	await openScenario(page);
	await page.getByRole('button', { name: /Utility Billing/ }).click();
	const route = page.locator('polyline.wb-civic-route-line[data-route="1"]');
	await expectCleanRoute(page, '1');
	expect(await route.evaluate((element: SVGPolylineElement): string => getComputedStyle(element).strokeLinejoin)).toBe('miter');
});

test('every routed destination renders a clean path that ends at its authored entrance', async ({ page }): Promise<void> => {
	await openScenario(page);
	const destinations = await page.locator('[data-destination-id]').evaluateAll((buttons: Element[]): Array<{ floor: string; id: string }> => (
		buttons.map((button: Element): { floor: string; id: string } => ({
			floor: button.querySelector('small')?.textContent?.trim() ?? '',
			id: button.getAttribute('data-destination-id') ?? ''
		}))
	));
	const routedDestinations = destinations.filter(({ id }: { id: string }): boolean => id !== 'main-lobby');

	expect(routedDestinations.length).toBeGreaterThan(0);
	for (const destination of routedDestinations) {
		await page.getByRole('button', { name: 'Reset' }).click();
		await page.locator(`[data-destination-id="${destination.id}"]`).click();
		if (destination.floor !== '1') {
			await page.getByRole('button', { name: `View Level ${destination.floor}` }).click();
		}
		await expectCleanRoute(page, destination.floor);
	}
});

test('every visible map label stays inside its room and clear of amenities', async ({ page }): Promise<void> => {
	await openScenario(page);

	for (const floor of ['1', '2', '3']) {
		if (floor !== '1') await page.getByRole('tab', { name: `Level ${floor}` }).click();
		const floorMap = page.locator(`[data-wayfinding-level="${floor}"]`);
		await expect(floorMap.locator('[data-wayfinding-label-for][data-wb-label-fitted="true"]')).toHaveCount(
			await floorMap.locator('[data-wayfinding-label-for]').count()
		);
		const defects = await floorMap.evaluate((element: SVGGElement): string[] => {
			const overlaps = (left: DOMRect, right: DOMRect): boolean => (
				left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top
			);
			const issues: string[] = [];
			const amenities: DOMRect[] = Array.from(element.querySelectorAll<SVGGElement>('.wb-civic-amenity'))
				.map((amenity: SVGGElement): DOMRect => amenity.getBoundingClientRect());

			for (const label of Array.from(element.querySelectorAll<SVGGElement>('[data-wayfinding-label-for]'))) {
				const id: string = label.dataset.wayfindingLabelFor ?? '';
				const zone: SVGGraphicsElement | null = element.querySelector<SVGGraphicsElement>(`[data-wayfinding-location-id="${id}"]`);
				if (!zone) {
					issues.push(`${id}: missing zone`);
					continue;
				}
				const labelBounds: DOMRect = label.getBoundingClientRect();
				const zoneBounds: DOMRect = zone.getBoundingClientRect();
				const tolerance = 1;

				if (labelBounds.left < zoneBounds.left - tolerance || labelBounds.right > zoneBounds.right + tolerance || labelBounds.top < zoneBounds.top - tolerance || labelBounds.bottom > zoneBounds.bottom + tolerance) {
					issues.push(`${id}: label leaves room`);
				}
				if (amenities.some((amenity: DOMRect): boolean => overlaps(labelBounds, amenity))) issues.push(`${id}: label overlaps amenity`);
			}

			return issues;
		});

		expect(defects).toEqual([]);
	}
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
	await expectCleanRoute(page, '3');
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
