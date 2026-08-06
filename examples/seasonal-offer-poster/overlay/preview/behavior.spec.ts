import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { sampleOffers } from './fixture';

const ROOT = '[data-preview-id="offer-poster-root"]';
const CANVAS = '[data-preview-id="offer-canvas"]';

const DESIGN_RATIO = 1920 / 1080;

const openScenario = async (page: Page, scenario?: string, size = { width: 1920, height: 1080 }): Promise<void> => {
	await page.setViewportSize(size);
	const query: string = scenario ? `?scenario=${scenario}&background=checker` : '?background=checker';
	const response = await page.goto(`/preview/widget.html${query}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await expect(page.locator(CANVAS)).toBeVisible();
};

const canvasBox = async (page: Page): Promise<{ height: number; width: number }> => {
	const box = await page.locator(CANVAS).boundingBox();

	if (!box) throw new Error('The poster canvas has no bounding box.');

	return { width: box.width, height: box.height };
};

test('the canvas keeps its authored ratio on a surface of a different shape', async ({ page }): Promise<void> => {
	// The archetype's entire claim. A reflowing layout would fill the square and change the design;
	// this one must stay 16:9 and let the surround take the rest.
	await openScenario(page, 'square-letterbox', { width: 900, height: 900 });

	const box = await canvasBox(page);

	expect(box.width / box.height).toBeCloseTo(DESIGN_RATIO, 2);
	await expect(page.locator(ROOT)).toHaveAttribute('data-letterbox', 'true');
});

test('an authored-ratio surface produces no letterbox at all', async ({ page }): Promise<void> => {
	await openScenario(page);

	await expect(page.locator(ROOT)).toHaveAttribute('data-letterbox', 'false');

	const box = await canvasBox(page);

	expect(Math.round(box.width)).toBe(1920);
	expect(Math.round(box.height)).toBe(1080);
});

test('a wide, short surface letterboxes at the sides rather than stretching', async ({ page }): Promise<void> => {
	await openScenario(page, 'ultra-wide-letterbox', { width: 1920, height: 540 });

	const box = await canvasBox(page);

	expect(box.width / box.height).toBeCloseTo(DESIGN_RATIO, 2);
	// Height-bound: the poster is as tall as the surface and narrower than it.
	expect(Math.round(box.height)).toBe(540);
	expect(box.width).toBeLessThan(1920);
});

test('scaling down preserves every part of the poster, including the small print', async ({ page }): Promise<void> => {
	await openScenario(page, 'square-letterbox', { width: 900, height: 900 });

	// Present and non-empty rather than merely rendered: a fixed canvas that clipped its own
	// footer would still report the right ratio.
	await expect(page.locator('.wb-offer-poster-brand')).not.toBeEmpty();
	await expect(page.locator('.wb-offer-poster-headline')).not.toBeEmpty();
	await expect(page.locator('.wb-offer-poster-price strong')).not.toBeEmpty();
	await expect(page.locator('.wb-offer-poster-small-print')).not.toBeEmpty();
});

test('a double space in the headline starts a new line', async ({ page }): Promise<void> => {
	await openScenario(page);

	const authored: string = String(sampleOffers[0].headline);
	const expected: number = authored.split(/\s{2,}/).length;

	await expect(page.locator('.wb-offer-poster-headline span')).toHaveCount(expected);
	expect(expected).toBeGreaterThan(1);
});

test('an offer with no price omits the price block rather than printing an empty badge', async ({ page }): Promise<void> => {
	await openScenario(page, 'no-price');

	await expect(page.locator('[data-preview-id="offer-price"]')).toHaveCount(0);
	await expect(page.locator('.wb-offer-poster-headline')).not.toBeEmpty();
});

test('a single bound offer never rotates', async ({ page }): Promise<void> => {
	await openScenario(page, 'single-offer');

	await expect(page.locator(ROOT)).toHaveAttribute('data-offer-count', '1');
	await expect(page.locator(ROOT)).toHaveAttribute('data-offer-index', '0');
	await page.waitForTimeout(600);
	await expect(page.locator(ROOT)).toHaveAttribute('data-offer-index', '0');
});

test('several offers rotate on the configured cadence and wrap', async ({ page }): Promise<void> => {
	await page.clock.install();
	await openScenario(page);

	const total: number = sampleOffers.length;

	await expect(page.locator(ROOT)).toHaveAttribute('data-offer-count', String(total));

	for (let step = 1; step <= total; step += 1) {
		await page.clock.fastForward(12_000);
		await expect(page.locator(ROOT)).toHaveAttribute('data-offer-index', String(step % total));
	}
});

test('the surround fills the space the poster does not occupy', async ({ page }): Promise<void> => {
	await openScenario(page, 'square-letterbox', { width: 900, height: 900 });

	const surround: string = await page.locator(ROOT).evaluate((element: Element): string => {
		return window.getComputedStyle(element).backgroundColor;
	});
	const canvas: string = await page.locator(CANVAS).evaluate((element: Element): string => {
		return window.getComputedStyle(element).backgroundColor;
	});

	// Distinct colours, so the letterbox reads as framing rather than as the poster failing to fill.
	expect(surround).not.toBe(canvas);
	expect(surround).not.toBe('rgba(0, 0, 0, 0)');
});
