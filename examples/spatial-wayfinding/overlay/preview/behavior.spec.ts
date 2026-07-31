import { expect, test } from '@playwright/test';
import type {
	Page,
	TestInfo
} from '@playwright/test';

const openApp = async (
	page: Page,
	viewport: { height: number; width: number } = { width: 1440, height: 900 },
	query = ''
): Promise<void> => {
	await page.setViewportSize(viewport);
	const response = await page.goto(`/preview/widget.html?background=light${query}`);
	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError));
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

test('supports global multi-building discovery, indoor entry, atlas guidance, and exploded 3D', async ({ page }): Promise<void> => {
	await openApp(page, { width: 1920, height: 1080 }, '&venue=multi-building');
	const root = page.locator('[data-preview-id="spatial-wayfinding-root"]');
	await expect(root).toHaveAttribute('data-runtime-project', 'multi-building-campus');
	await expect(page.locator('.wb-spatial-wayfinding-building')).toHaveCount(3);
	const libraryResult = page.getByRole('button', { name: 'Building / 3 levels Library Explore inside', exact: true });
	await expect(libraryResult).toBeVisible();
	await expect(page.getByRole('button', { name: 'Building / 2 levels Science Center Explore inside', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Building / 0 levels Arena Exterior destination', exact: true })).toBeVisible();

	await libraryResult.click();
	await expect(root).toHaveAttribute('data-selected-building', 'library');
	await expect(page.getByRole('button', { name: 'Explore inside', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Directions', exact: true }).click();
	await expect(root).toHaveAttribute('data-overview-mode', 'atlas-2d');
	await expect(page.locator('.wb-spatial-wayfinding-atlas-level')).toHaveCount(4);

	await page.getByRole('button', { name: 'Explore inside', exact: true }).click();
	await expect(page.getByLabel('Level')).toHaveValue('library-ground');
	await page.getByLabel('Search destinations').fill('Special Collections');
	await page.getByRole('button', { name: 'Library Special Collections', exact: true }).click();
	await expect(root).toHaveAttribute('data-selected-destination', 'archives');
	await expect(page.locator('.wb-spatial-wayfinding-atlas-level')).toHaveCount(3);
	await page.getByRole('button', { name: 'Exploded 3D' }).click();
	await expect(root).toHaveAttribute('data-overview-mode', 'exploded-3d');
	await expect(root.locator('canvas')).toHaveAttribute('data-overview-mode', 'exploded-3d');
	await expect(root.locator('canvas')).toHaveAttribute('data-exploded-level-count', '3');
});

const runtimeSurfaceProblems = (page: Page): Promise<string[]> => page.evaluate(() => {
	const visible = (element: Element): boolean => {
		const style = getComputedStyle(element);
		const bounds = element.getBoundingClientRect();

		return element.checkVisibility({
			checkOpacity: true,
			checkVisibilityCSS: true
		})
			&& style.display !== 'none'
			&& style.visibility !== 'hidden'
			&& Number(style.opacity) > 0
			&& bounds.width > 1
			&& bounds.height > 1
			&& bounds.right > 0
			&& bounds.bottom > 0
			&& bounds.left < innerWidth
			&& bounds.top < innerHeight;
	};
	const label = (element: Element): string => {
		const html = element as HTMLElement;

		return html.getAttribute('aria-label')
			?? html.textContent?.trim().replace(/\s+/gu, ' ').slice(0, 42)
			?? element.tagName.toLocaleLowerCase();
	};
	const problems: string[] = [];
	const root = document.querySelector('.wb-spatial-wayfinding-root');

	if (!root) return ['runtime root missing'];
	const rootBounds = root.getBoundingClientRect();

	if (
		Math.abs(rootBounds.width - innerWidth) > 1
		|| Math.abs(rootBounds.height - innerHeight) > 1
	) problems.push(`runtime root ${Math.round(rootBounds.width)}x${Math.round(rootBounds.height)}`);

	for (const control of [...root.querySelectorAll('button, input, select')].filter(visible)) {
		const bounds = control.getBoundingClientRect();
		const html = control as HTMLInputElement;
		const insideScrollableArea = Boolean(control.closest(
			'.wb-spatial-wayfinding-destinations, .wb-spatial-wayfinding-details, .wb-spatial-wayfinding-route-levels'
		));

		if (
			bounds.left < rootBounds.left - 1
			|| bounds.right > rootBounds.right + 1
			|| (!insideScrollableArea && (
				bounds.top < rootBounds.top - 1
				|| bounds.bottom > rootBounds.bottom + 1
			))
		) problems.push(`clipped ${label(control)}`);

		if (control.matches('button') && !html.getAttribute('aria-label') && !html.textContent?.trim()) {
			problems.push(`unnamed action ${label(control)}`);
		}

		if (
			control.matches('input, select')
			&& !html.labels?.length
			&& !html.getAttribute('aria-label')
			&& !html.getAttribute('aria-labelledby')
		) problems.push(`unlabelled field ${label(control)}`);

		if (control.matches('button') && (bounds.width < 34 || bounds.height < 34)) {
			problems.push(`small target ${label(control)} ${Math.round(bounds.width)}x${Math.round(bounds.height)}`);
		}
	}

	return problems;
});

const captureRuntime = async (
	page: Page,
	testInfo: TestInfo,
	viewport: { height: number; width: number }
): Promise<void> => {
	await openApp(page, viewport);
	await page.getByRole('button', { name: '2D', exact: true }).click();
	await page.getByRole('button', { name: 'Food / G31 Campus Cafe Open', exact: true }).click();
	await expect(page.locator('.wb-spatial-wayfinding-route')).toBeVisible();
	expect(await runtimeSurfaceProblems(page), `${viewport.width}x${viewport.height}`).toEqual([]);
	const mapBounds = await page.getByRole('region', { name: 'Campus map', exact: true }).boundingBox();
	const directoryBounds = await page.locator('.wb-spatial-wayfinding-directory').boundingBox();
	expect(mapBounds).not.toBeNull();
	expect(directoryBounds).not.toBeNull();

	if (viewport.height > viewport.width) {
		expect(mapBounds!.width).toBeGreaterThan(viewport.width * 0.98);
		expect(mapBounds!.height).toBeGreaterThan(viewport.height * 0.5);
		expect(directoryBounds!.width).toBeGreaterThan(viewport.width * 0.98);
	} else {
		expect(mapBounds!.width).toBeGreaterThan(viewport.width * 0.54);
		expect(directoryBounds!.width).toBeLessThan(viewport.width * 0.46);
	}
	const screenshotPath = testInfo.outputPath(`published-${viewport.width}x${viewport.height}.png`);
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach(`published-${viewport.width}x${viewport.height}`, {
		contentType: 'image/png',
		path: screenshotPath
	});
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

test('replaces the complete 2D and 3D origin artwork with the published custom marker', async ({ page }): Promise<void> => {
	await openApp(page);
	const root = page.locator('[data-preview-id="spatial-wayfinding-root"]');
	const canvas = root.locator('canvas');
	await expect(canvas).toHaveAttribute('data-origin-marker-3d', 'custom-image-replacement');
	await expect(canvas).toHaveAttribute('data-origin-marker-size3d', '84');
	await expect(canvas).toHaveAttribute('data-origin-marker-texture', 'ready');
	await page.getByRole('button', { name: '2D', exact: true }).click();
	const marker = page.locator('.wb-spatial-wayfinding-origin');
	await expect(marker).toHaveAttribute('data-origin-marker', 'custom-image-replacement');
	await expect(marker.locator('.wb-spatial-wayfinding-origin-artwork')).toHaveAttribute('width', '64');
	await expect(marker.locator('.wb-spatial-wayfinding-origin-artwork')).toHaveAttribute('height', '32');
	await expect(marker.locator('.wb-spatial-wayfinding-origin-core')).toHaveCount(0);
	await expect(marker.locator('.wb-spatial-wayfinding-origin-beacon')).toHaveCount(1);
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
	await expect(page.locator('.wb-spatial-wayfinding-route-flow')).toBeVisible();
	await expect(page.locator('.wb-spatial-wayfinding-zone.wb-spatial-wayfinding-selected')).toHaveCount(1);
	await expect(page.locator('.wb-spatial-wayfinding-target-pulse')).toBeVisible();
	await expect(page.locator('.wb-spatial-wayfinding-instructions')).toContainText('turn left');
	await expect(page.locator('.wb-spatial-wayfinding-instructions')).toContainText('Arrive at your destination');
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

test('keeps the idle map legible and emphasizes only the selected destination', async ({ page }): Promise<void> => {
	await openApp(page);
	await page.getByRole('button', { name: '2D', exact: true }).click();
	const idleZone = page.locator('.wb-spatial-wayfinding-destination-zone').first();
	await expect(idleZone).toHaveCSS('fill-opacity', '0.96');
	await expect(page.locator('.wb-spatial-wayfinding-walkable')).toHaveCSS('fill-opacity', '0');
	await page.getByRole('button', { name: 'Food / G31 Campus Cafe Open', exact: true }).click();
	const selectedZone = page.locator('.wb-spatial-wayfinding-zone.wb-spatial-wayfinding-selected');
	await expect(selectedZone).toHaveCount(1);
	await expect(selectedZone).toHaveCSS('fill-opacity', '0.96');
});

test('resets selection and camera without destroying the scene', async ({ page }): Promise<void> => {
	await openApp(page);
	const root = page.locator('[data-preview-id="spatial-wayfinding-root"]');
	await page.getByRole('button', { name: 'Food / G31 Campus Cafe Open', exact: true }).click();
	await expect(root).toHaveAttribute('data-selected-destination', 'campus-cafe');
	await page.getByRole('button', { name: 'Reset view' }).click();
	await expect(root).toHaveAttribute('data-selected-destination', '');
	await expect(root.locator('canvas')).toBeVisible();
});

test('keeps the published map map-first across the signage viewport matrix', async ({ page }, testInfo): Promise<void> => {
	test.setTimeout(120_000);
	const consoleProblems: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') {
			consoleProblems.push(`${message.type()}: ${message.text()}`);
		}
	});
	page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.stack ?? error.message}`));

	for (const viewport of [
		{ width: 800, height: 480 },
		{ width: 1280, height: 720 },
		{ width: 1920, height: 1080 },
		{ width: 1080, height: 1920 },
		{ width: 3840, height: 2160 }
	] as const) {
		await captureRuntime(page, testInfo, viewport);
	}

	expect(consoleProblems).toEqual([]);
});
