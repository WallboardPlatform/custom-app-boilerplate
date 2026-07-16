import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const openClock = async (page: Page, width = 1280, height = 720): Promise<void> => {
	await page.setViewportSize({ width, height });
	const response = await page.goto('/preview/widget.html?background=dark');

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError);
	});
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

const pushConfiguration = async (page: Page, configValues: Record<string, unknown>): Promise<void> => {
	await page.evaluate((nextConfigValues: Record<string, unknown>): void => {
		const previewWindow = window as Window & {
			__wallboardPreview?: { pushConfiguration: (values: Record<string, unknown>) => void };
		};

		if (!previewWindow.__wallboardPreview) {
			throw new Error('Preview configuration bridge is unavailable.');
		}

		previewWindow.__wallboardPreview.pushConfiguration(nextConfigValues);
	}, configValues);
};

test('ticks every second and remains disposed after destroy', async ({ page }): Promise<void> => {
	await page.clock.install({ time: new Date('2026-07-15T12:00:00Z') });
	await openClock(page);
	const root = page.locator('.wb-single-hero-clock-root');
	const initialEpoch: number = Number(await root.getAttribute('data-epoch-second'));

	await page.clock.fastForward(1000);
	await expect.poll(async (): Promise<number> => Number(await root.getAttribute('data-epoch-second'))).toBe(initialEpoch + 1);

	await page.evaluate(async (): Promise<void> => {
		await (window as Window & { __wallboardPreview?: { destroy: () => Promise<void> } }).__wallboardPreview?.destroy();
	});
	await page.clock.fastForward(5000);
	await expect(page.locator('#wallboard-preview-root')).toBeEmpty();
});

test('updates timezone through the real configuration event path', async ({ page }): Promise<void> => {
	await page.clock.install({ time: new Date('2026-07-15T12:00:00Z') });
	await openClock(page);
	await expect(page.locator('.wb-single-hero-clock-hours')).toHaveText('14');

	await pushConfiguration(page, { timezone: 'Asia/Tokyo', locationLabel: 'Tokyo' });
	await expect(page.locator('.wb-single-hero-clock-root')).toHaveAttribute('data-timezone', 'Asia/Tokyo');
	await expect(page.locator('.wb-single-hero-clock-hours')).toHaveText('21');
	await expect(page.locator('.wb-single-hero-clock-location strong')).toHaveText('Tokyo');
});

test('switches hero composition when its assigned zone changes', async ({ page }): Promise<void> => {
	await openClock(page, 3000, 300);
	await expect(page.locator('.wb-single-hero-clock-root')).toHaveAttribute('data-layout', 'ultra-wide');

	await page.setViewportSize({ width: 1080, height: 1920 });
	await expect(page.locator('.wb-single-hero-clock-root')).toHaveAttribute('data-layout', 'tall');

	await page.setViewportSize({ width: 320, height: 180 });
	await expect(page.locator('.wb-single-hero-clock-root')).toHaveAttribute('data-layout', 'compact');
});
