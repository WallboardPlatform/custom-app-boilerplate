import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { registerEmptyStateConformance } from './conformance/empty-state';

import { registerStatusIndicatorConformance } from './conformance/status-indicator';

/*
 * Presence is the one status wall where colour is the most tempting shortcut: the platform it mirrors
 * uses a coloured dot as the whole vocabulary. The suite requires the word alongside it.
 */
registerStatusIndicatorConformance({
	name: 'Presence cards',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?background=dark');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
		await expect(page.locator('.wb-presence-card').first()).toBeVisible();
	},
	indicators: (page: Page): Locator => page.locator('.wb-presence-card'),
	stateAttribute: 'data-group',
	// The status line specifically. The card also carries the person's name, which would pass a
	// looser check with the availability text removed entirely.
	stateLabel: (indicator: Locator): Locator => indicator.locator('.wb-presence-card-status')
});

/*
 * An empty datasource is the state a customer is most certain to meet and the author least likely
 * to have looked at: no data on the first day, nothing after a filter, a source down at 3am. The
 * suite requires the surface to still say something legible rather than going blank.
 */
registerEmptyStateConformance({
	name: 'Team presence board',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?scenario=empty&background=light');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	},
	root: (page: Page): Locator => page.locator('.wb-presence-app'),
	// The message itself, not the surface around it: measuring the container is how the defect this
	// suite was rewritten for used to pass.
	message: (page: Page): Locator => page.locator('.wb-presence-empty'),
	viewing: 'room'
});
