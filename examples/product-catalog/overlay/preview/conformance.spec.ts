import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { registerEmptyStateConformance } from './conformance/empty-state';

registerEmptyStateConformance({
	name: 'Product catalog',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?scenario=empty&background=light');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	},
	root: (page: Page): Locator => page.locator('.wb-product-catalog-root'),
	identity: (page: Page): Locator => page.locator('.wb-product-catalog-header'),
	message: (page: Page): Locator => page.locator('.wb-product-catalog-empty h2'),
	viewing: 'room'
});
