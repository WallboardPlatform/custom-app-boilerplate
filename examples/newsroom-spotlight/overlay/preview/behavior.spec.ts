import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const openScenario = async (
	page: Page,
	scenario: string,
	viewport: { width: number; height: number },
	installClock = false
): Promise<void> => {
	if (installClock) {
		await page.clock.install({ time: new Date() });
	}

	await page.setViewportSize(viewport);
	const query: URLSearchParams = new URLSearchParams({ background: 'light', scenario });
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError);
	});
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

test('normalizes the current Wallboard channel and legacy RSS feed wrappers', async ({ page }): Promise<void> => {
	await openScenario(page, 'wallboard-feed', { width: 1920, height: 1080 });
	await expect(page.locator('.wb-app')).toHaveAttribute('data-feed-source', 'wallboard-feed');
	await expect(page.locator('.story-title')).toHaveText('A quieter language for public technology');

	await openScenario(page, 'rss-parser', { width: 1536, height: 432 });
	await expect(page.locator('.wb-app')).toHaveAttribute('data-feed-source', 'rss-parser');
	await expect(page.locator('.story-title')).toHaveText('The station that became a civic room');

	await openScenario(page, 'rss-channel', { width: 1080, height: 1920 });
	await expect(page.locator('.wb-app')).toHaveAttribute('data-feed-source', 'rss-channel');
	await expect(page.locator('.story-title')).toHaveText('A quieter language for public technology');
});

test('rotates to the next valid story after the configured duration', async ({ page }): Promise<void> => {
	await openScenario(page, 'rotation', { width: 1366, height: 768 }, true);
	const title = page.locator('.story-title');

	await expect(title).toHaveText('A quieter language for public technology');
	await page.clock.fastForward(2100);
	await expect(title).toHaveText('The station that became a civic room');
});

test('replaces failed media with the designed fallback', async ({ page }): Promise<void> => {
	await openScenario(page, 'broken-media', { width: 960, height: 540 });
	await expect(page.locator('.story-media')).toHaveAttribute('data-media-state', 'fallback');
	await expect(page.locator('.story-media-fallback')).toBeVisible();
	await expect(page.locator('.story-media img')).toHaveCount(0);
});
