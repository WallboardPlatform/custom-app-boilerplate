import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

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
