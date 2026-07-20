import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface ControlledInterval {
	active: boolean;
	id: number;
	invoke: () => void;
}

interface CatalogWindow extends Window {
	__catalogIntervals?: ControlledInterval[];
	__wallboardPreview?: {
		destroy: () => Promise<void>;
		pushConfiguration: (configValues: Record<string, unknown>) => void;
	};
}

const installControlledRotation = async (page: Page): Promise<void> => {
	await page.addInitScript((): void => {
		const catalogWindow = window as CatalogWindow;
		const nativeSetInterval = window.setInterval.bind(window);
		const nativeClearInterval = window.clearInterval.bind(window);
		const intervals: ControlledInterval[] = [];

		catalogWindow.__catalogIntervals = intervals;
		window.setInterval = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]): number => {
			if (timeout === 3000 && typeof handler === 'function') {
				const interval: ControlledInterval = {
					active: true,
					id: 7200 + intervals.length,
					invoke: (): void => handler(...arguments_)
				};

				intervals.push(interval);

				return interval.id;
			}

			return nativeSetInterval(handler, timeout, ...arguments_);
		}) as typeof window.setInterval;
		window.clearInterval = ((id: number | undefined): void => {
			const interval = intervals.find((candidate): boolean => candidate.id === id);

			if (interval) {
				interval.active = false;

				return;
			}

			nativeClearInterval(id);
		}) as typeof window.clearInterval;
	});
};

const openCatalog = async (page: Page): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	const response = await page.goto('/preview/widget.html?width=1920&height=1080&background=light');

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
};

test.beforeEach(async ({ page }): Promise<void> => {
	await installControlledRotation(page);
	await openCatalog(page);
	await page.evaluate((): void => {
		(window as CatalogWindow).__wallboardPreview?.pushConfiguration({ pageDurationSeconds: 3 });
	});
	await page.waitForFunction((): boolean => {
		return Boolean((window as CatalogWindow).__catalogIntervals?.some((interval): boolean => interval.active));
	});
});

test('renders file-picker images stored directly in TABLE rows', async ({ page }): Promise<void> => {
	await expect(page.locator('.wb-product-catalog-root')).toHaveAttribute('data-media-visible', 'true');
	await expect(page.locator('.wb-product-catalog-stage')).toHaveAttribute('data-product-key', 'FN-101');
	await expect(page.locator('.wb-product-catalog-media img')).toHaveAttribute('src', /arc-lamp/);
});

test('recovers failed image loads with the local fallback layer', async ({ page }): Promise<void> => {
	const image = page.locator('.wb-product-catalog-media img');

	await image.evaluate((element: HTMLImageElement): void => {
		element.src = 'data:image/png;base64,AA==';
	});
	await expect(page.locator('.wb-product-catalog-root')).toHaveAttribute('data-media-visible', 'false');
	await expect(page.locator('.wb-product-catalog-media-fallback')).toHaveAttribute('data-visible', 'true');
	await expect(image).toHaveAttribute('src', /^data:image\/gif/);
});

test('rotates products with a bounded transition and no empty frame', async ({ page }): Promise<void> => {
	await page.evaluate((): void => {
		const interval = (window as CatalogWindow).__catalogIntervals?.find((candidate): boolean => candidate.active);

		if (!interval?.active) {
			throw new Error('Catalog rotation interval is unavailable.');
		}

		interval.invoke();
	});

	await expect(page.locator('.wb-product-catalog-root')).toHaveAttribute('data-page-index', '1');
	await expect(page.locator('.wb-product-catalog-stage')).toHaveAttribute('data-product-key', 'FN-204');
	await expect(page.locator('.wb-product-catalog-media img')).toHaveAttribute('src', /pulse-speaker/);
	await expect(page.locator('.wb-product-catalog-root')).toHaveAttribute('data-transitioning', 'true');
	await page.waitForTimeout(350);
	await expect(page.locator('.wb-product-catalog-root')).toHaveAttribute('data-transitioning', 'false');
});

test('cleans the instance-local rotation on destroy', async ({ page }): Promise<void> => {
	await page.evaluate(async (): Promise<void> => {
		const catalogWindow = window as CatalogWindow;

		await catalogWindow.__wallboardPreview?.destroy();
	});

	const active = await page.evaluate((): boolean[] => {
		return ((window as CatalogWindow).__catalogIntervals ?? []).map((interval): boolean => interval.active);
	});

	expect(active.length).toBeGreaterThan(0);
	expect(active.every((value): boolean => !value)).toBe(true);
});
