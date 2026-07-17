import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface PreviewWindow extends Window {
	__wallboardPreview?: {
		pushDatasource: (property: string, value: unknown) => void;
	};
}

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
		return (
			document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError)
		);
	});
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

test('normalizes calendar and feed provider wrappers into one venue pulse', async ({ page }): Promise<void> => {
	await openScenario(page, 'microsoft-calendar-current-feed', { width: 1920, height: 1080 });
	await expect(page.locator('.wb-civic-venue-pulse')).toHaveAttribute('data-calendar-source', 'google-or-microsoft');
	await expect(page.locator('.wb-civic-venue-pulse')).toHaveAttribute('data-feed-source', 'wallboard-feed');
	await expect(page.locator('.wb-civic-venue-pulse-program-title')).toHaveText('Open Studio: Clay and Light');
	await expect(page.locator('.wb-civic-venue-pulse-announcement-title')).toHaveText(
		'Maple Street doors are open for courtyard access'
	);

	await openScenario(page, 'icalendar-legacy-feed', { width: 800, height: 480 });
	await expect(page.locator('.wb-civic-venue-pulse')).toHaveAttribute('data-calendar-source', 'icalendar');
	await expect(page.locator('.wb-civic-venue-pulse')).toHaveAttribute('data-feed-source', 'rss-parser');
	await expect(page.locator('.wb-civic-venue-pulse-program-title')).toHaveText('Neighborhood Photography Walk');
	await expect(page.locator('.wb-civic-venue-pulse-announcement-title')).toHaveText(
		'Workshop check-in has moved beside the bookshop'
	);
});

test('rotates overlapping active programs without losing now state', async ({ page }): Promise<void> => {
	await openScenario(page, 'google-overlap', { width: 800, height: 480 }, true);
	await expect(page.locator('.wb-civic-venue-pulse-program-panel')).toHaveAttribute('data-state', 'now');
	await expect(page.locator('.wb-civic-venue-pulse-program-title')).toHaveText('Foundry Maker Talk');
	await page.clock.fastForward(4100);
	await expect(page.locator('.wb-civic-venue-pulse-program-panel')).toHaveAttribute('data-state', 'now');
	await expect(page.locator('.wb-civic-venue-pulse-program-title')).toHaveText('Sound Objects Listening Room');
});

test('uses all-day labels and ignores stale announcements with broken media', async ({ page }): Promise<void> => {
	await openScenario(page, 'all-day', { width: 800, height: 480 });
	await expect(page.locator('.wb-civic-venue-pulse-program-time')).toHaveText('All day');

	await openScenario(page, 'broken-media-stale-feed', { width: 1920, height: 1080 });
	await expect(page.locator('.wb-civic-venue-pulse-announcement-title')).toHaveText(
		'Fresh note appears without broken media'
	);
	await expect(page.locator('.wb-civic-venue-pulse-announcement-title')).not.toHaveText(
		'Old gallery announcement should not appear'
	);
	await expect(page.locator('.wb-civic-venue-pulse-announcement-media img')).toHaveCount(0);
});

test('promotes a feed-only announcement without duplicating the support rail', async ({ page }): Promise<void> => {
	await openScenario(page, 'feed-only', { width: 800, height: 480 });
	await expect(page.locator('.wb-civic-venue-pulse-announcement-only')).toBeVisible();
	await expect(page.locator('.wb-civic-venue-pulse-announcement-panel')).toHaveCount(0);
	await expect(page.locator('.wb-civic-venue-pulse-announcement-title')).toHaveCount(1);
	await expect(page.locator('.wb-civic-venue-pulse-announcement-title')).toHaveText(
		'Maple Street doors are open for courtyard access'
	);
});

test('keeps explicitly marked synthetic samples current after their reference timestamps expire', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'feed-only', { width: 800, height: 480 }, true);
	await page.evaluate((): void => {
		const preview = (window as PreviewWindow).__wallboardPreview;
		preview?.pushDatasource('calendarData', {
			_wallboardSample: { mode: 'relative-to-now' },
			events: [
				{
					id: 'relative-calendar-sample',
					title: 'Relative sample program',
					_sampleStartOffsetMinutes: -10,
					_sampleEndOffsetMinutes: 40,
					start: { dateTime: '2020-01-01T10:00:00Z' },
					end: { dateTime: '2020-01-01T11:00:00Z' }
				}
			]
		});
	});
	await expect(page.locator('.wb-civic-venue-pulse-program-title')).toHaveText('Relative sample program');

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushDatasource('feedData', {
			_wallboardSample: { mode: 'relative-to-now' },
			items: [
				{
					guid: 'relative-feed-sample',
					title: 'Relative sample announcement',
					_samplePublishedOffsetMinutes: -20,
					publishDate: 1577836800
				}
			]
		});
	});

	await expect(page.locator('.wb-civic-venue-pulse-program-title')).toHaveText('Relative sample program');
	await expect(page.locator('.wb-civic-venue-pulse-announcement-title')).toHaveText('Relative sample announcement');
});

test('applies independent datasource updates without resetting unrelated rotation', async ({ page }): Promise<void> => {
	await openScenario(page, 'google-overlap', { width: 800, height: 480 }, true);
	await page.clock.fastForward(4100);
	await expect(page.locator('.wb-civic-venue-pulse-program-title')).toHaveText('Sound Objects Listening Room');
	const beforeIndex: string | null = await page.locator('.wb-civic-venue-pulse').getAttribute('data-program-index');

	await page.evaluate((): void => {
		(window as PreviewWindow).__wallboardPreview?.pushDatasource('feedData', {
			items: [
				{
					guid: 'live-feed-test',
					title: 'Live updated lobby note',
					description: 'Fresh venue note.',
					publishDate: Math.floor(Date.now() / 1000),
					categories: ['Live']
				}
			]
		});
	});

	await expect(page.locator('.wb-civic-venue-pulse-announcement-title')).toHaveText('Live updated lobby note');
	await expect(page.locator('.wb-civic-venue-pulse-program-title')).toHaveText('Sound Objects Listening Room');
	await expect(page.locator('.wb-civic-venue-pulse')).toHaveAttribute('data-program-index', beforeIndex ?? '1');

	await page.evaluate((): void => {
		const now = Date.now();
		(window as PreviewWindow).__wallboardPreview?.pushDatasource('calendarData', {
			events: [
				{
					id: 'live-calendar-test',
					status: 'confirmed',
					title: 'Live updated studio program',
					description: 'Calendar update.',
					location: 'Studio 2',
					start: { timeStamp: String(now - 600000) },
					end: { timeStamp: String(now + 2400000) }
				}
			]
		});
	});

	await expect(page.locator('.wb-civic-venue-pulse-program-title')).toHaveText('Live updated studio program');
	await expect(page.locator('.wb-civic-venue-pulse-announcement-title')).toHaveText('Live updated lobby note');
});
