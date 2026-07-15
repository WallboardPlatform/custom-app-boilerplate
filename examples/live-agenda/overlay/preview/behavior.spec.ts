import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const openScenario = async (page: Page, scenario: string, width: number, height: number): Promise<void> => {
	await page.setViewportSize({ width, height });
	const query: URLSearchParams = new URLSearchParams({ background: 'dark', scenario });
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return (
			document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError)
		);
	});
	expect(await page.evaluate((): string | undefined => document.documentElement.dataset.previewError)).toBeUndefined();
};

test('normalizes Microsoft-style and iCalendar events into the same agenda hierarchy', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'microsoft-calendar', 1920, 1080);
	await expect(page.locator('.wb-app')).toHaveAttribute('data-calendar-source', 'google-or-microsoft');
	await expect(page.locator('.featured-title')).toHaveText('Designing calm public information');
	await expect(page.locator('.upcoming-event')).toHaveCount(3);

	await openScenario(page, 'icalendar', 1536, 432);
	await expect(page.locator('.wb-app')).toHaveAttribute('data-calendar-source', 'icalendar');
	await expect(page.locator('.featured-title')).toHaveText('Live systems briefing');
	await expect(page.locator('.upcoming-event')).toHaveCount(2);
});

test('marks the current event live and reports bounded progress', async ({ page }): Promise<void> => {
	await openScenario(page, 'microsoft-calendar', 1920, 1080);

	const featured = page.locator('.agenda-featured');
	await expect(featured).toHaveAttribute('data-active', 'true');
	await expect(featured.locator('.featured-status')).toContainText('Now');
	await expect(featured.locator('.featured-footer strong')).toHaveText('In progress');

	const progress: number = await featured.locator('.event-progress i').evaluate((element: HTMLElement): number => {
		const width: number = element.getBoundingClientRect().width;
		const parentWidth: number = element.parentElement?.getBoundingClientRect().width ?? 0;

		return parentWidth > 0 ? (width / parentWidth) * 100 : 0;
	});

	expect(progress).toBeGreaterThan(35);
	expect(progress).toBeLessThan(55);
});

test('uses an explicit all-day label for all-day calendar entries', async ({ page }): Promise<void> => {
	await openScenario(page, 'all-day', 600, 600);
	await expect(page.locator('.featured-time')).toHaveText('All day');
});

test('Full HD headings preserve descender clearance in bounded and repeated labels', async ({
	page
}): Promise<void> => {
	await openScenario(page, 'microsoft-calendar', 1920, 1080);

	for (const selector of ['.agenda-heading h1', '.featured-title', '.upcoming-header h3', '.upcoming-copy h4']) {
		const metrics = await page
			.locator(selector)
			.first()
			.evaluate((element: HTMLElement) => {
				const style: CSSStyleDeclaration = window.getComputedStyle(element);

				return {
					fontSize: Number.parseFloat(style.fontSize),
					lineHeight: Number.parseFloat(style.lineHeight),
					paddingBottom: Number.parseFloat(style.paddingBottom)
				};
			});

		expect(metrics.lineHeight / metrics.fontSize, `${selector} line height`).toBeGreaterThanOrEqual(1.15);
		expect(metrics.paddingBottom / metrics.fontSize, `${selector} bottom padding`).toBeGreaterThanOrEqual(0.079);
	}
});
