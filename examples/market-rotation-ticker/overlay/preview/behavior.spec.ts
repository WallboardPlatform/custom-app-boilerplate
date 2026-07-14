import { expect, test } from '@playwright/test';

test('ticker stays populated until the final market item exits', async ({ page }): Promise<void> => {
	test.setTimeout(30000);
	const query: URLSearchParams = new URLSearchParams({
		width: '1536',
		height: '136',
		background: 'dark',
		scenario: 'market-rotation'
	});
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await page.waitForSelector('.wb-app[data-market="nasdaq100"][data-phase="scroll"] .stock-item');

	const readCoverage = async (): Promise<{
		leftGap: number;
		rightGap: number;
		maximumInternalGap: number;
		lastMainRight: number;
		viewportLeft: number;
	}> => page.evaluate(() => {
		const viewport: HTMLElement | null = document.querySelector<HTMLElement>('.ticker-viewport');
		const lastMainItem: HTMLElement | null = document.querySelector<HTMLElement>(
			'.ticker-track--main .stock-item:last-child'
		);

		if (!viewport || !lastMainItem) {
			throw new Error('Ticker rail was not available for coverage inspection.');
		}

		const viewportRect: DOMRect = viewport.getBoundingClientRect();
		const segments: Array<{ left: number; right: number }> = Array.from(
			document.querySelectorAll<HTMLElement>('.ticker-track .stock-item')
		)
			.map((element: HTMLElement): DOMRect => element.getBoundingClientRect())
			.filter((rect: DOMRect): boolean => rect.right > viewportRect.left && rect.left < viewportRect.right)
			.map((rect: DOMRect): { left: number; right: number } => ({
				left: Math.max(viewportRect.left, rect.left),
				right: Math.min(viewportRect.right, rect.right)
			}))
			.sort((left, right): number => left.left - right.left);

		if (segments.length === 0) {
			throw new Error('Ticker viewport contained no visible stock items.');
		}

		let maximumInternalGap: number = 0;

		for (let index: number = 1; index < segments.length; index += 1) {
			maximumInternalGap = Math.max(maximumInternalGap, segments[index].left - segments[index - 1].right);
		}

		return {
			leftGap: segments[0].left - viewportRect.left,
			rightGap: viewportRect.right - segments[segments.length - 1].right,
			maximumInternalGap,
			lastMainRight: lastMainItem.getBoundingClientRect().right,
			viewportLeft: viewportRect.left
		};
	});

	await page.waitForTimeout(120);
	const movingCoverage = await readCoverage();
	expect(movingCoverage.leftGap).toBeLessThanOrEqual(1);
	expect(movingCoverage.rightGap).toBeLessThanOrEqual(1);
	expect(movingCoverage.maximumInternalGap).toBeLessThanOrEqual(1);

	await page.waitForSelector('.wb-app[data-market="nasdaq100"][data-phase="scroll-exit"]');
	const finalCoverage = await readCoverage();
	expect(finalCoverage.lastMainRight).toBeLessThanOrEqual(finalCoverage.viewportLeft + 1);
	expect(finalCoverage.leftGap).toBeLessThanOrEqual(1);
	expect(finalCoverage.rightGap).toBeLessThanOrEqual(1);
	expect(finalCoverage.maximumInternalGap).toBeLessThanOrEqual(1);

	await page.waitForSelector('.wb-app[data-market="tsx60"][data-phase="title"] .exchange-title');
});

test('exchange title scrolls throughout its display phase', async ({ page }): Promise<void> => {
	const query: URLSearchParams = new URLSearchParams({
		width: '1536',
		height: '136',
		background: 'dark'
	});
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await page.waitForSelector('.wb-app[data-phase="title"] .exchange-title__rail');

	const readTranslateX = async (): Promise<number> => page.locator('.exchange-title__rail').evaluate((element) => {
		const transform: string = window.getComputedStyle(element).transform;

		if (transform === 'none') {
			return 0;
		}

		return new DOMMatrixReadOnly(transform).m41;
	});

	const initialPosition: number = await readTranslateX();
	await page.waitForTimeout(250);
	const movedPosition: number = await readTranslateX();

	expect(movedPosition).toBeLessThan(initialPosition - 1);
	expect(await page.locator('.exchange-title__track--main strong').count()).toBeGreaterThan(1);
});
