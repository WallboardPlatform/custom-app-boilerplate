import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { registerEmptyStateConformance } from './conformance/empty-state';
import { registerStatusIndicatorConformance } from './conformance/status-indicator';

const ROOT = '[data-preview-id="global-office-clock-root"]';

const open = (scenario: string) => async (page: Page): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	const response = await page.goto(`/preview/widget.html?scenario=${scenario}&background=dark`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
};

registerEmptyStateConformance({
	name: 'Global office clock',
	open: open('empty'),
	root: (page: Page): Locator => page.locator(ROOT),
	identity: (page: Page): Locator => page.locator('.wb-global-office-clock-title'),
	message: (page: Page): Locator => page.locator('.wb-global-office-clock-empty-message'),
	viewing: 'room'
});

registerStatusIndicatorConformance({
	name: 'Office open state',
	open: open('app-default'),
	indicators: (page: Page): Locator => page.locator('[data-open-state]'),
	stateAttribute: 'data-open-state',
	stateLabel: (indicator: Locator): Locator => indicator.locator('.wb-global-office-clock-open-state')
});
