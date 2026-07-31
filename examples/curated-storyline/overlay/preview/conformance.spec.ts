import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { registerEmptyStateConformance } from './conformance/empty-state';

/*
 * An empty datasource is the state a customer is most certain to meet and the author least likely
 * to have looked at: no data on the first day, nothing after a filter, a source down at 3am. The
 * suite requires the surface to still say something legible rather than going blank.
 */
registerEmptyStateConformance({
	name: 'Curated storyline',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?scenario=empty&background=light');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	},
	root: (page: Page): Locator => page.locator('#wallboard-preview-root > *').first(),
	// The message itself, not the surface around it: measuring the container is how the defect this
	// suite was rewritten for used to pass.
	message: (page: Page): Locator => page.locator('.wb-curated-storyline-empty'),
	viewing: 'room'
});
