import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { registerStatusIndicatorConformance } from './conformance/status-indicator';

/*
 * This example is the portfolio's reference for the status-wall mechanism and was not running the
 * status-indicator suite. That is the gap worth closing first: an app others are meant to copy
 * should be the one most certainly conformant, not the one nothing checks.
 */
registerStatusIndicatorConformance({
	name: 'Agent status cards',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?background=dark');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
		await expect(page.locator('.agent-card').first()).toBeVisible();
	},
	indicators: (page: Page): Locator => page.locator('.agent-card'),
	stateAttribute: 'data-agent-tone',
	// The state word, not the card: the card also carries a name, a timer and three metrics, any of
	// which would satisfy a looser "has text somewhere" check while the state itself was missing.
	stateLabel: (indicator: Locator): Locator => indicator.locator('.agent-identity b')
});
