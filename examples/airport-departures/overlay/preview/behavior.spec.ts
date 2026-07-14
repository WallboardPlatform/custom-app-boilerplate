import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const pageDurationMs: number = 3000;

const openScenario = async (
	page: Page,
	scenario: string,
	viewport: { width: number; height: number }
): Promise<void> => {
	await page.clock.install({ time: new Date('2026-01-15T12:00:00Z') });
	await page.setViewportSize(viewport);
	const query: URLSearchParams = new URLSearchParams({ background: 'dark', scenario });
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => {
		return (
			document.documentElement.dataset.previewReady === 'true' || Boolean(document.documentElement.dataset.previewError)
		);
	});

	const previewError: string | undefined = await page.evaluate((): string | undefined => {
		return document.documentElement.dataset.previewError;
	});

	expect(previewError).toBeUndefined();
	await expect(page.locator('.departures-header h1')).toHaveText('Departures');
	const pauseTime: number = await page.evaluate((): number => Date.now() + 100);
	await page.clock.pauseAt(pauseTime);
};

test('maximum content paginates to the next fixed-size row window', async ({ page }): Promise<void> => {
	await openScenario(page, 'maximum-content', { width: 1920, height: 1080 });

	const rows = page.locator('.departure-row');
	const departureTimes = rows.locator('.departure-time strong');
	const ribbon = page.locator('.departures-ribbon');

	await expect(ribbon).toContainText('30 FLIGHTS');
	await expect(ribbon.locator('b')).toHaveText('PAGE 1 / 4');
	await expect(rows).toHaveCount(9);
	await expect(departureTimes.first()).toHaveText('09:00');
	await expect(departureTimes.last()).toHaveText('11:00');

	await page.clock.fastForward(pageDurationMs);

	await expect(ribbon.locator('b')).toHaveText('PAGE 2 / 4');
	await expect(rows).toHaveCount(9);
	await expect(departureTimes.first()).toHaveText('11:15');
	await expect(departureTimes.last()).toHaveText('13:15');
});

test('final partial page fills the row area with equal non-overlapping rows', async ({ page }): Promise<void> => {
	await openScenario(page, 'last-page', { width: 1366, height: 768 });

	await expect(page.locator('.departures-ribbon b')).toHaveText('PAGE 1 / 3');
	await expect(page.locator('.departure-row')).toHaveCount(7);

	await page.clock.fastForward(pageDurationMs);
	await expect(page.locator('.departures-ribbon b')).toHaveText('PAGE 2 / 3');
	await page.clock.fastForward(pageDurationMs);
	await expect(page.locator('.departures-ribbon b')).toHaveText('PAGE 3 / 3');

	const rows = page.locator('.departure-row');

	await expect(rows).toHaveCount(2);
	await expect(rows.locator('.departure-time strong')).toHaveText(['12:30', '12:45']);

	const layout = await page.evaluate(() => {
		const list: HTMLElement | null = document.querySelector<HTMLElement>('.departures-list');
		const rowElements: HTMLElement[] = Array.from(document.querySelectorAll<HTMLElement>('.departure-row'));

		if (!list || rowElements.length !== 2) {
			throw new Error('Expected the final departure page to contain exactly two rows.');
		}

		const listRect: DOMRect = list.getBoundingClientRect();
		const rowRects: DOMRect[] = rowElements.map((row: HTMLElement): DOMRect => row.getBoundingClientRect());
		let maximumGap: number = 0;
		let maximumOverlap: number = 0;

		for (let index: number = 1; index < rowRects.length; index += 1) {
			const boundaryDelta: number = rowRects[index].top - rowRects[index - 1].bottom;

			maximumGap = Math.max(maximumGap, boundaryDelta);
			maximumOverlap = Math.max(maximumOverlap, -boundaryDelta);
		}

		return {
			listHeight: listRect.height,
			rowHeights: rowRects.map((rect: DOMRect): number => rect.height),
			topGap: rowRects[0].top - listRect.top,
			bottomGap: listRect.bottom - rowRects[rowRects.length - 1].bottom,
			maximumGap,
			maximumOverlap
		};
	});

	expect(Math.max(...layout.rowHeights) - Math.min(...layout.rowHeights)).toBeLessThanOrEqual(1);
	expect(layout.rowHeights.reduce((total: number, height: number): number => total + height, 0)).toBeCloseTo(
		layout.listHeight,
		1
	);
	expect(Math.abs(layout.topGap)).toBeLessThanOrEqual(1);
	expect(Math.abs(layout.bottomGap)).toBeLessThanOrEqual(1);
	expect(layout.maximumGap).toBeLessThanOrEqual(1);
	expect(layout.maximumOverlap).toBeLessThanOrEqual(0.5);
});
