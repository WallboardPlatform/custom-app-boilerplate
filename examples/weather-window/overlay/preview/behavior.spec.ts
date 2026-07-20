import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		pushConfiguration: (configValues: Record<string, unknown>) => void;
		platform: { cachedUrls: string[] };
	};
}

const openScenario = async (page: Page, scenario?: string): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	const query = new URLSearchParams({ background: 'dark' });

	if (scenario) query.set('scenario', scenario);

	const response = await page.goto(`/preview/widget.html?${query.toString()}`);
	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError);
	});
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

test('renders normalized platform weather and routes media through the cache path', async ({ page }): Promise<void> => {
	await openScenario(page);

	await expect(page.locator('.wb-weather-window-root')).toHaveAttribute('data-state', 'ready');
	await expect(page.locator('.wb-weather-window-location')).toHaveText('Budapest');
	await expect(page.locator('.wb-weather-window-temperature')).toHaveText('21°');
	await expect(page.locator('.wb-weather-window-forecast-item')).toHaveCount(4);
	await expect(page.locator('.wb-weather-window-forecast-item').first()).toContainText('Sunday');
	await expect(page.locator('.wb-weather-window-forecast-label')).toContainText('4');
	await expect(page.locator('.wb-weather-window-forecast-label')).toContainText('DAY OUTLOOK');

	const cachedUrls = await page.evaluate((): string[] => {
		return (window as PreviewWindow).__wallboardPreview?.platform.cachedUrls ?? [];
	});
	expect(cachedUrls.some((url): boolean => url.includes('budapest-riverside.jpg'))).toBe(true);
	expect(cachedUrls.some((url): boolean => url.startsWith('data:image/svg+xml'))).toBe(true);
});

test('refetches when the configured location changes', async ({ page }): Promise<void> => {
	await openScenario(page);

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushConfiguration({ cityCode: 'Vienna', countryCode: 'AT' });
	});

	await expect(page.locator('.wb-weather-window-location')).toHaveText('Vienna');
	await expect(page.locator('.wb-weather-window-temperature')).toHaveText('24°');
	await expect(page.locator('.wb-weather-window-condition')).toHaveText('Clear and calm');
});

test('preserves the last valid reading when a later refresh fails', async ({ page }): Promise<void> => {
	await openScenario(page, 'stale-update');
	await expect(page.locator('.wb-weather-window-temperature')).toHaveText('21°');

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushConfiguration({ cityCode: 'Failure', countryCode: 'ZZ' });
	});

	await expect(page.locator('.wb-weather-window-root')).toHaveAttribute('data-state', 'stale');
	await expect(page.locator('.wb-weather-window-temperature')).toHaveText('21°');
	await expect(page.locator('.wb-weather-window-status')).toHaveText('AWAITING UPDATE');
});

test('shows designed unavailable and media fallback states', async ({ page }): Promise<void> => {
	await openScenario(page, 'unavailable');
	await expect(page.locator('.wb-weather-window-root')).toHaveAttribute('data-state', 'unavailable');
	await expect(page.locator('.wb-weather-window-unavailable')).toContainText('TEMPORARILY UNAVAILABLE');

	await openScenario(page, 'missing-media');
	await expect(page.locator('.wb-weather-window-background')).toHaveCount(0);
	await expect(page.locator('.wb-weather-window-icon-fallback')).toBeVisible();
	await expect(page.locator('.wb-weather-window-temperature')).toHaveText('21°');
});

test('short forecasts expand without reserved empty cells and motion can be disabled', async ({ page }): Promise<void> => {
	await openScenario(page, 'short-forecast');
	await expect(page.locator('.wb-weather-window-forecast-item')).toHaveCount(1);

	await openScenario(page, 'motion-off');
	await expect(page.locator('.wb-weather-window-root')).toHaveAttribute('data-motion-preset', 'off');
	const animationName = await page.locator('.wb-weather-window-background').evaluate((element): string => {
		return getComputedStyle(element).animationName;
	});
	expect(animationName).toBe('none');
});
