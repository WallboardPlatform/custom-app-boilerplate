import { expect, test } from '@playwright/test';

test('metric cards stay balanced and the throughput chart paints data', async ({ page }): Promise<void> => {
	const response = await page.goto('/preview/widget.html?background=dark');

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await page.waitForSelector('.wb-app__metrics article');
	await page.waitForFunction((): boolean => {
		const canvas: HTMLCanvasElement | null = document.querySelector<HTMLCanvasElement>('.wb-app__chart canvas');

		return Boolean(canvas && canvas.width > 0 && canvas.height > 0);
	});

	const metrics = await page.evaluate(() => {
		const cards: HTMLElement[] = Array.from(document.querySelectorAll<HTMLElement>('.wb-app__metrics article'));
		const canvas: HTMLCanvasElement | null = document.querySelector<HTMLCanvasElement>('.wb-app__chart canvas');

		if (cards.length !== 3 || !canvas) {
			throw new Error('Expected three metric cards and one chart canvas.');
		}

		const cardRects: DOMRect[] = cards.map((card: HTMLElement): DOMRect => card.getBoundingClientRect());
		const context: CanvasRenderingContext2D | null = canvas.getContext('2d');

		if (!context) {
			throw new Error('Chart canvas did not expose a 2D context.');
		}

		const pixels: Uint8ClampedArray = context.getImageData(0, 0, canvas.width, canvas.height).data;
		let paintedPixels: number = 0;

		for (let index: number = 3; index < pixels.length; index += 4) {
			if (pixels[index] > 0) {
				paintedPixels += 1;
			}
		}

		return {
			widths: cardRects.map((rect: DOMRect): number => rect.width),
			heights: cardRects.map((rect: DOMRect): number => rect.height),
			nonOverlapping: cardRects.every((rect: DOMRect, index: number): boolean => {
				return index === cardRects.length - 1 || rect.right <= cardRects[index + 1].left + 1;
			}),
			canvasWidth: canvas.getBoundingClientRect().width,
			canvasHeight: canvas.getBoundingClientRect().height,
			paintedPixels
		};
	});

	expect(Math.max(...metrics.widths) - Math.min(...metrics.widths)).toBeLessThanOrEqual(1);
	expect(Math.max(...metrics.heights) - Math.min(...metrics.heights)).toBeLessThanOrEqual(1);
	expect(metrics.nonOverlapping).toBe(true);
	expect(metrics.canvasWidth).toBeGreaterThan(400);
	expect(metrics.canvasHeight).toBeGreaterThan(150);
	expect(metrics.paintedPixels).toBeGreaterThan(100);
});

test('preview teardown removes the Chart.js instance', async ({ page }): Promise<void> => {
	const response = await page.goto('/preview/widget.html?background=dark');

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await page.waitForSelector('.wb-app__chart canvas');

	const lifecycle = await page.evaluate(async () => {
		interface ChartInstance {
			id: string;
		}
		interface ChartModule {
			Chart: {
				getChart: (canvas: HTMLCanvasElement) => ChartInstance | undefined;
				instances: Record<string, ChartInstance>;
			};
		}
		interface PreviewWindow extends Window {
			__wallboardPreview?: { destroy: () => Promise<void> };
		}

		const canvas: HTMLCanvasElement | null = document.querySelector<HTMLCanvasElement>('.wb-app__chart canvas');

		if (!canvas) {
			throw new Error('Throughput chart canvas was not found.');
		}

		const chartModuleUrl: string | undefined = performance
			.getEntriesByType('resource')
			.map((entry: PerformanceEntry): string => entry.name)
			.find((url: string): boolean => /\/node_modules\/\.vite\/deps\/chart.*js/i.test(url));

		if (!chartModuleUrl) {
			throw new Error('The loaded Chart.js module URL was not found.');
		}

		const chartModule = (await import(chartModuleUrl)) as ChartModule;
		const previewWindow = window as PreviewWindow;
		const initialInstance: ChartInstance | undefined = chartModule.Chart.getChart(canvas);

		if (!initialInstance || !previewWindow.__wallboardPreview) {
			throw new Error('Chart instance or preview lifecycle bridge was unavailable.');
		}

		const initialCount: number = Object.keys(chartModule.Chart.instances).length;

		await previewWindow.__wallboardPreview.destroy();

		return {
			initialCount,
			remainingCount: Object.keys(chartModule.Chart.instances).length,
			chartRemoved: chartModule.Chart.getChart(canvas) === undefined
		};
	});

	expect(lifecycle.initialCount).toBe(1);
	expect(lifecycle.chartRemoved).toBe(true);
	expect(lifecycle.remainingCount).toBe(0);
});

test('empty datasource state replaces the chart and remains centered', async ({ page }): Promise<void> => {
	const response = await page.goto('/preview/widget.html?background=light&scenario=empty');

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await expect(page.locator('.wb-app__empty-state')).toContainText('No operational data is available.');
	await expect(page.locator('.wb-app__chart canvas')).toHaveCount(0);

	const centered = await page.locator('.wb-app__empty-state').evaluate((element: HTMLElement): boolean => {
		const root: HTMLElement | null = document.querySelector<HTMLElement>('#wallboard-preview-root');

		if (!root) {
			throw new Error('Preview root was not found.');
		}

		const rootRect: DOMRect = root.getBoundingClientRect();
		const emptyRect: DOMRect = element.getBoundingClientRect();
		const rootCenterX: number = rootRect.left + rootRect.width / 2;
		const emptyCenterX: number = emptyRect.left + emptyRect.width / 2;

		return Math.abs(rootCenterX - emptyCenterX) <= 1 && emptyRect.height > rootRect.height / 2;
	});

	expect(centered).toBe(true);
});
