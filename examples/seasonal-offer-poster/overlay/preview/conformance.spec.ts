import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { registerEmptyStateConformance } from './conformance/empty-state';

/*
 * An empty datasource is the state a customer is most certain to meet and the author least likely
 * to have looked at. On a poster it is also the state most likely to be skipped entirely, because
 * an empty canvas still looks like a designed surface rather than like a fault.
 */
registerEmptyStateConformance({
	name: 'Seasonal offer poster',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?scenario=empty&background=light');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	},
	root: (page: Page): Locator => page.locator('[data-preview-id="offer-canvas"]'),
	identity: (page: Page): Locator => page.locator('.wb-offer-poster-brand'),
	// The message, not the canvas: the brand line is larger and would satisfy a looser check while
	// the explanation itself was set at footnote size.
	message: (page: Page): Locator => page.locator('.wb-offer-poster-empty-message'),
	viewing: 'distance'
});
