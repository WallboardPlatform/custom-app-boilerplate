import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface SpokenGuidanceRecord {
	lang: string;
	text: string;
}

interface WayfindingPreviewWindow extends Window {
	__initialWayfinding2dMap?: Element;
	__spokenGuidance?: SpokenGuidanceRecord[];
	__speechCancelCount?: number;
	__wallboardPreview?: {
		pushDatasource: (property: string, value: unknown) => void;
	};
}

test.setTimeout(120_000);

const installSpeechSpy = async (page: Page): Promise<void> => {
	await page.addInitScript((): void => {
		const previewWindow = window as WayfindingPreviewWindow;
		const spoken: SpokenGuidanceRecord[] = [];

		previewWindow.__spokenGuidance = spoken;
		previewWindow.__speechCancelCount = 0;
		window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance): void => {
			spoken.push({ lang: utterance.lang, text: utterance.text });
		};
		window.speechSynthesis.cancel = (): void => {
			previewWindow.__speechCancelCount = (previewWindow.__speechCancelCount ?? 0) + 1;
		};
	});
};

const openKiosk = async (page: Page): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	const response = await page.goto('/preview/widget.html?background=dark');

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await expect(page.locator('[data-preview-id="wayfinding-kiosk-root"]')).toHaveAttribute('data-viewer-ready', 'true', { timeout: 120_000 });
};

test.beforeEach(async ({ page }): Promise<void> => {
	await installSpeechSpy(page);
	await openKiosk(page);
});

test('offers the ordinary authored 2D map and normal 3D exploration', async ({ page }): Promise<void> => {
	const root = page.locator('[data-preview-id="wayfinding-kiosk-root"]');
	const scene = page.locator('.wb-wayfinding-kiosk-scene');

	await expect(root).toHaveAttribute('data-viewer-dimension', '2d');
	await expect(scene).toHaveAttribute('data-wayfinding-viewer-dimension', '2d');
	await expect(scene).toBeVisible();
	await expect(page.locator('.wayfinding-viewer-2d-viewport')).toBeVisible();
	await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveAttribute('aria-pressed', 'true');

	await page.getByRole('button', { name: '3D', exact: true }).click();
	await expect(root).toHaveAttribute('data-viewer-dimension', '3d');
	await expect(scene).toHaveAttribute('data-wayfinding-viewer-dimension', '3d');
	await expect(page.locator('.wayfinding-viewer-2d-shell')).toBeHidden();
	await expect(scene.locator('canvas')).toBeVisible();

	await page.getByRole('button', { name: '2D', exact: true }).click();
	await expect(root).toHaveAttribute('data-viewer-dimension', '2d');
	await expect(page.locator('.wayfinding-viewer-2d-shell')).toBeVisible();
});

test('replays the authored animated 2D route when a destination is selected', async ({ page }): Promise<void> => {
	const root = page.locator('[data-preview-id="wayfinding-kiosk-root"]');
	const scene = page.locator('.wb-wayfinding-kiosk-scene');
	const destination = page.getByRole('button', { name: /Visitor services Ground floor Open/ });
	const routeOverlay = page.locator('.wayfinding-viewer-2d-shell').locator('.route-overlay');
	const route = routeOverlay.locator('.simulated-route');

	await destination.click();
	await expect(root).toHaveAttribute('data-viewer-mode', 'route');
	await expect(root).toHaveAttribute('data-viewer-dimension', '2d');
	await expect(scene).toHaveAttribute('data-wayfinding-viewer-mode', 'route');
	await expect(page.getByText('ANIMATED ROUTE PREVIEW', { exact: true })).toBeVisible();
	await expect(route).toHaveCount(1);
	await expect(routeOverlay).toHaveAttribute('data-route-replay-token', '1');
	await expect.poll(() => route.evaluate((element): number => element.getAnimations().length)).toBeGreaterThan(0);
	await expect(route).toHaveCSS('stroke-dasharray', 'none', { timeout: 2_000 });
	await expect(route).toHaveCSS('stroke-dashoffset', '0px');
	await expect.poll(async (): Promise<number> => page.evaluate((): number => {
		return (window as WayfindingPreviewWindow).__spokenGuidance?.length ?? 0;
	})).toBe(0);

	await destination.click();
	await expect(routeOverlay).toHaveAttribute('data-route-replay-token', '2');
	await expect.poll(() => route.evaluate((element): number => element.getAnimations().length)).toBeGreaterThan(0);
	await expect(route).toHaveCSS('stroke-dasharray', 'none', { timeout: 2_000 });
	await expect(route).toHaveCSS('stroke-dashoffset', '0px');
});

test('keeps 2D framing and origin scale stable while revealing one continuous authored route', async ({ page }): Promise<void> => {
	const viewport = page.getByRole('application', { name: 'Interactive 2D wayfinding map' });
	const map = page.locator('.wayfinding-viewer-2d-shell').locator('.map-transform');
	const routeOverlay = page.locator('.wayfinding-viewer-2d-shell').locator('.route-overlay');
	const route = routeOverlay.locator('.simulated-route');
	const flow = routeOverlay.locator('.simulated-route-flow');
	const origin = page.locator('.wayfinding-viewer-2d-shell').locator('.visitor-origin-marker__core');
	const mapBefore = await map.getAttribute('style');
	const originBefore = await origin.boundingBox();

	await page.getByRole('button', { name: /Visitor services Ground floor Open/ }).click();
	await expect(routeOverlay).toHaveAttribute('data-route-replay-token', '1');
	await expect(map).toHaveAttribute('style', mapBefore ?? '');
	await expect(routeOverlay.locator('.simulated-route-chevron')).toHaveCount(0);
	expect(await route.getAttribute('d')).toBe(await flow.getAttribute('d'));

	await expect(flow).toHaveCSS('opacity', '1', { timeout: 2_000 });
	await expect(route).toHaveCSS('stroke-dasharray', 'none', { timeout: 2_000 });
	await expect(route).toHaveCSS('stroke-dashoffset', '0px');
	await viewport.press('=');
	const originAfter = await origin.boundingBox();

	expect(originBefore).not.toBeNull();
	expect(originAfter).not.toBeNull();
	// Browser transform quantization can move an SVG edge by a fraction of one
	// device pixel, but zoom must never scale the marker itself.
	expect(Math.abs(originAfter!.width - originBefore!.width)).toBeLessThan(0.75);
	expect(Math.abs(originAfter!.height - originBefore!.height)).toBeLessThan(0.75);
});

test('keeps the same authored fit inside Wallboard\'s 1920 to 2560 fixed-canvas scale', async ({ page }): Promise<void> => {
	const root = page.locator('[data-preview-id="wayfinding-kiosk-root"]');
	const scene = page.locator('.wb-wayfinding-kiosk-scene');
	const map = page.locator('.wayfinding-viewer-2d-shell').locator('.map-transform');

	await page.getByRole('button', { name: 'Reset view' }).click();
	const logicalFit = await map.evaluate((element): number[] => {
		const matrix = new DOMMatrix((element as HTMLElement).style.transform);

		return [matrix.a, matrix.d, matrix.e, matrix.f];
	});

	await page.setViewportSize({ width: 2560, height: 1440 });
	await root.evaluate((element): void => {
		const htmlElement = element as HTMLElement;

		htmlElement.style.width = '1920px';
		htmlElement.style.height = '1080px';
		htmlElement.style.transform = 'scale(1.3333333333333333)';
		htmlElement.style.transformOrigin = '0 0';
	});
	await page.getByRole('button', { name: 'Reset view' }).click();

	const scaledHostFit = await map.evaluate((element): number[] => {
		const matrix = new DOMMatrix((element as HTMLElement).style.transform);

		return [matrix.a, matrix.d, matrix.e, matrix.f];
	});
	expect(scaledHostFit[0]).toBeCloseTo(logicalFit[0], 5);
	expect(scaledHostFit[1]).toBeCloseTo(logicalFit[1], 5);
	expect(Math.abs(scaledHostFit[2] - logicalFit[2])).toBeLessThan(0.75);
	expect(Math.abs(scaledHostFit[3] - logicalFit[3])).toBeLessThan(0.75);
	const stageBounds = await scene.boundingBox();
	const mapBounds = await page.locator('.wayfinding-viewer-2d-shell').locator('.map-svg').boundingBox();

	expect(stageBounds).not.toBeNull();
	expect(mapBounds).not.toBeNull();
	expect(mapBounds!.x).toBeGreaterThanOrEqual(stageBounds!.x - 1);
	expect(mapBounds!.y).toBeGreaterThanOrEqual(stageBounds!.y - 1);
	expect(mapBounds!.x + mapBounds!.width).toBeLessThanOrEqual(stageBounds!.x + stageBounds!.width + 1);
	expect(mapBounds!.y + mapBounds!.height).toBeLessThanOrEqual(stageBounds!.y + stageBounds!.height + 1);

	await page.getByRole('button', { name: /Visitor services Ground floor Open/ }).click();
	const selectedFit = await map.evaluate((element): number[] => {
		const matrix = new DOMMatrix((element as HTMLElement).style.transform);

		return [matrix.a, matrix.d, matrix.e, matrix.f];
	});
	expect(selectedFit).toEqual(scaledHostFit);
	await expect(page.locator('.wayfinding-viewer-2d-shell').locator('.simulated-route')).toHaveCSS(
		'stroke-dasharray',
		'none',
		{ timeout: 2_000 }
	);
});

test('shows the complete exploded route without manual step navigation', async ({ page }): Promise<void> => {
	await page.getByRole('button', { name: /Visitor services Ground floor Open/ }).click();
	await page.getByRole('button', { name: /Start 3D route/ }).click();

	const root = page.locator('[data-preview-id="wayfinding-kiosk-root"]');
	const scene = page.locator('.wb-wayfinding-kiosk-scene');

	await expect(root).toHaveAttribute('data-journey-active', 'true');
	await expect(root).toHaveAttribute('data-viewer-dimension', '3d');
	await expect(scene).toHaveAttribute('data-wayfinding-viewer-mode', 'journey');
	await expect(scene).toHaveAttribute('data-overview-mode', 'exploded-3d');
	await expect(page.locator('.wayfinding-viewer-2d-shell')).toBeHidden();
	await expect(scene.locator('canvas')).toBeVisible();
	await expect.poll(async (): Promise<number> => Number(await scene.getAttribute('data-exploded-route-segment-count'))).toBeGreaterThan(0);
	await expect(page.getByRole('button', { name: /Next|Previous|Atlas/i })).toHaveCount(0);

	await page.getByRole('button', { name: /End route/ }).click();
	await expect(root).toHaveAttribute('data-viewer-dimension', '2d');
	await expect(root).toHaveAttribute('data-viewer-mode', 'route');
	await page.getByRole('button', { name: /Start 3D route/ }).click();
	await expect(root).toHaveAttribute('data-journey-active', 'true');
	await expect(page.getByText('Select a destination before starting navigation.')).toHaveCount(0);
});

test('reuses the prepared 3D scene when switching 3D to 2D before starting the route', async ({ page }): Promise<void> => {
	const scene = page.locator('.wb-wayfinding-kiosk-scene');

	await page.getByRole('button', { name: /Visitor services Ground floor Open/ }).click();
	await page.getByRole('button', { name: '3D', exact: true }).click();
	await expect(scene).toHaveAttribute('data-exploded-journey-motion', 'overview');
	const preparedBuildCount = await scene.getAttribute('data-scene-builds');

	await page.getByRole('button', { name: '2D', exact: true }).click();
	await page.getByRole('button', { name: /Start 3D route/ }).click();
	await expect(scene).toHaveAttribute('data-wayfinding-viewer-mode', 'journey');
	await expect(scene).toHaveAttribute('data-exploded-journey-motion', 'replay');
	await expect(scene).toHaveAttribute('data-exploded-journey-camera-travel-ratio', '0.000');
	await expect(scene).toHaveAttribute('data-exploded-journey-arrival-zoom', '1.000');
	await expect(scene).toHaveAttribute('data-scene-builds', preparedBuildCount ?? '1');
});

test('finishes the route reveal and holds the destination in the safe route frame', async ({ page }): Promise<void> => {
	await page.getByRole('button', { name: /Visitor services Ground floor Open/ }).click();
	await page.getByRole('button', { name: /Start 3D route/ }).click();
	const scene = page.locator('.wb-wayfinding-kiosk-scene');

	await expect.poll(
		async (): Promise<string | null> => scene.getAttribute('data-exploded-route-reveal-progress'),
		{ timeout: 55_000 }
	).toBe('1.000');
	await expect(scene).toHaveAttribute('data-exploded-journey-camera-phase', 'route-complete');
});

test('speaks authored guidance on visitor-triggered route start and replay', async ({ page }): Promise<void> => {
	await page.getByRole('button', { name: /Visitor services Ground floor Open/ }).click();
	await page.getByRole('button', { name: /Start 3D route/ }).click();
	const root = page.locator('[data-preview-id="wayfinding-kiosk-root"]');

	await expect(root).toHaveAttribute('data-spoken-guidance-ready', 'true');
	await expect.poll(async (): Promise<number> => page.evaluate((): number => {
		return (window as WayfindingPreviewWindow).__spokenGuidance?.length ?? 0;
	})).toBe(1);

	await page.getByRole('button', { name: /Replay route/ }).click();
	await expect.poll(async (): Promise<number> => page.evaluate((): number => {
		return (window as WayfindingPreviewWindow).__spokenGuidance?.length ?? 0;
	})).toBe(2);

	const spoken = await page.evaluate((): SpokenGuidanceRecord[] => {
		return (window as WayfindingPreviewWindow).__spokenGuidance ?? [];
	});

	expect(spoken.every((item): boolean => item.lang.toLowerCase().startsWith('en'))).toBe(true);
	expect(spoken.every((item): boolean => item.text.trim().length > 0)).toBe(true);
});

test('creates a stable semantic mobile handoff without leaking a storage path', async ({ page }): Promise<void> => {
	await page.getByRole('button', { name: /Visitor services Ground floor Open/ }).click();
	await page.getByRole('button', { name: /Take it with you/ }).click();
	const dialog = page.getByRole('dialog', { name: 'Take your route with you' });

	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('img', { name: /QR code/ })).toHaveAttribute('src', /^data:image\/png/u);
	const handoffUrl = await dialog.getAttribute('data-handoff-url');

	expect(handoffUrl).not.toBeNull();
	const parsed = new URL(handoffUrl!);

	expect(parsed.origin).toBe('https://apps.wallboard.us');
	expect(parsed.searchParams.get('wf')).toBe('1');
	expect(parsed.searchParams.get('app')).toBe('Wayfinding Kiosk');
	expect(parsed.searchParams.get('appVersion')).toBe('2');
	expect(parsed.searchParams.get('map')).toBe('assets/index.wbmap');
	expect(parsed.searchParams.get('destination')).toBe('library-help');
	expect(parsed.searchParams.get('datasource')).toBe('wayfinding-destination-status');
	expect(handoffUrl).not.toContain('/apps/widgets/');
});

test('applies live datasource availability without rebuilding the map', async ({ page }): Promise<void> => {
	const scene = page.locator('.wb-wayfinding-kiosk-scene');
	const initialBuilds = await scene.getAttribute('data-scene-builds');
	if (initialBuilds === null) await page.evaluate((): void => {
		const previewWindow = window as WayfindingPreviewWindow;
		previewWindow.__initialWayfinding2dMap = document
			.querySelector('.wayfinding-viewer-2d-shell')
			?.shadowRoot
			?.querySelector('.map-svg') ?? undefined;
	});

	await page.evaluate((): void => {
		(window as WayfindingPreviewWindow).__wallboardPreview?.pushDatasource('destinationData', {
			DestinationStatus: {
				rows: [{
					destinationId: 'library-help',
					available: false,
					status: 'Temporarily closed',
					waitMinutes: 0,
					note: 'Visitor assistance has moved to the east lobby.'
				}]
			}
		});
	});

	await page.getByRole('button', { name: /Visitor services Ground floor Temporarily closed/ }).click();
	await expect(page.getByText('Temporarily closed', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: /Start 3D route/ })).toBeDisabled();
	if (initialBuilds !== null) {
		await expect(scene).toHaveAttribute('data-scene-builds', initialBuilds);
	} else {
		await expect.poll(async (): Promise<boolean> => page.evaluate((): boolean => {
			const previewWindow = window as WayfindingPreviewWindow;
			const currentMap = document
				.querySelector('.wayfinding-viewer-2d-shell')
				?.shadowRoot
				?.querySelector('.map-svg');

			return Boolean(currentMap && currentMap === previewWindow.__initialWayfinding2dMap);
		})).toBe(true);
	}
});

test('audio control cancels active speech without ending the journey', async ({ page }): Promise<void> => {
	await page.getByRole('button', { name: /Visitor services Ground floor Open/ }).click();
	await page.getByRole('button', { name: /Start 3D route/ }).click();
	await page.getByRole('button', { name: 'Audio', exact: true }).click();

	await expect(page.getByRole('button', { name: 'Muted', exact: true })).toBeVisible();
	await expect(page.locator('[data-preview-id="wayfinding-kiosk-root"]')).toHaveAttribute('data-journey-active', 'true');
	await expect.poll(async (): Promise<number> => page.evaluate((): number => {
		return (window as WayfindingPreviewWindow).__speechCancelCount ?? 0;
	})).toBeGreaterThan(0);
});
