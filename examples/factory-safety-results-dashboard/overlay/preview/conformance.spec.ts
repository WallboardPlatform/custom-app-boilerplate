import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { registerEmptyStateConformance } from './conformance/empty-state';

const ROOT = '[data-preview-id="factory-safety-dashboard-root"]';

registerEmptyStateConformance({
	name: 'Safety readiness dashboard',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1366, height: 768 });
		const response = await page.goto('/preview/widget.html?scenario=empty&background=dark');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	},
	root: (page: Page): Locator => page.locator(ROOT),
	identity: (page: Page): Locator => page.locator('.wb-safety-dashboard-title'),
	// The board title is the only h1, so the first h2 is the empty-state headline.
	message: (page: Page): Locator => page.locator(`${ROOT} h2`).first(),
	viewing: 'room'
});
