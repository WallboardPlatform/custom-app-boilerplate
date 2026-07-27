import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { registerStatusIndicatorConformance } from './conformance/status-indicator';

registerStatusIndicatorConformance({
	name: 'Andon station rows',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1080, height: 1920 });
		const response = await page.goto('/preview/widget.html?scenario=mixed-line-load&background=dark');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	},
	indicators: (page: Page): Locator => page.locator('[data-state-tone]'),
	stateAttribute: 'data-state-tone',
	stateLabel: (indicator: Locator): Locator => indicator.locator('.station-row__state')
});
