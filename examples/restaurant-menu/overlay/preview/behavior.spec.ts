import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface ControlledInterval {
	active: boolean;
	delay: number;
	id: number;
	invoke: () => void;
}

interface ControlledIntervalWindow extends Window {
	__restaurantMenuIntervals?: ControlledInterval[];
	__wallboardPreview?: {
		destroy: () => Promise<void>;
		pushConfiguration: (configValues: Record<string, unknown>) => void;
	};
}

interface Rectangle {
	bottom: number;
	height: number;
	left: number;
	right: number;
	top: number;
	width: number;
}

const installControlledPageTransition = async (page: Page): Promise<void> => {
	await page.addInitScript((): void => {
		const controlledWindow: ControlledIntervalWindow = window as ControlledIntervalWindow;
		const nativeSetInterval: typeof window.setInterval = window.setInterval.bind(window);
		const nativeClearInterval: typeof window.clearInterval = window.clearInterval.bind(window);

		const controlledIntervals: ControlledInterval[] = [];

		controlledWindow.__restaurantMenuIntervals = controlledIntervals;
		window.setInterval = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]): number => {
			const delay: number = timeout ?? 0;

			if (delay === 3000 && typeof handler === 'function') {
				const interval: ControlledInterval = {
					active: true,
					delay,
					id: 7300 + controlledIntervals.length,
					invoke: (): void => handler(...arguments_)
				};

				controlledIntervals.push(interval);

				return interval.id;
			}

			return nativeSetInterval(handler, delay, ...arguments_);
		}) as typeof window.setInterval;
		window.clearInterval = ((id: number | undefined): void => {
			const interval = controlledIntervals.find((candidate): boolean => candidate.id === id);

			if (interval) {
				interval.active = false;

				return;
			}

			nativeClearInterval(id);
		}) as typeof window.clearInterval;
	});
};

const openLastPageScenario = async (page: Page): Promise<void> => {
	await page.setViewportSize({ width: 1366, height: 768 });
	const query: URLSearchParams = new URLSearchParams({
		width: '1366',
		height: '768',
		background: 'dark',
		scenario: 'last-page'
	});
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await expect(page.locator('.wb-restaurant-menu-edition em')).toHaveText('1 / 2');
};

const advanceToFinalPage = async (page: Page): Promise<void> => {
	const controlledIntervals: number[] = await page.evaluate((): number[] => {
		const controlledWindow: ControlledIntervalWindow = window as ControlledIntervalWindow;

		return (controlledWindow.__restaurantMenuIntervals ?? []).filter(
			(interval: ControlledInterval): boolean => interval.active
		).map(
			(interval: ControlledInterval): number => interval.delay
		);
	});

	expect(controlledIntervals).toEqual([3000]);
	await page.evaluate((): void => {
		const controlledWindow: ControlledIntervalWindow = window as ControlledIntervalWindow;
		const pageTransition: ControlledInterval | undefined = controlledWindow.__restaurantMenuIntervals?.find(
			(interval: ControlledInterval): boolean => interval.active
		);

		if (!pageTransition) {
			throw new Error('Restaurant menu did not register its page transition interval.');
		}

		pageTransition.invoke();
	});
	await expect(page.locator('.wb-restaurant-menu-edition em')).toHaveText('2 / 2');
};

test.beforeEach(async ({ page }): Promise<void> => {
	await installControlledPageTransition(page);
	await openLastPageScenario(page);
});

test('transitions after the configured duration and renders the uneven final page', async ({ page }): Promise<void> => {
	await expect(page.locator('.wb-restaurant-menu-category')).toHaveCount(4);
	await expect(page.locator('.wb-restaurant-menu-item')).toHaveCount(10);

	await advanceToFinalPage(page);

	const finalPage = await page.locator('.wb-restaurant-menu-category').evaluateAll((categories: Element[]) => {
		return categories.map((category: Element) => ({
			title: category.querySelector('h2')?.textContent?.trim() ?? '',
			itemCount: category.querySelectorAll('.wb-restaurant-menu-item').length
		}));
	});

	expect(finalPage).toEqual([
		{ title: 'Drinks', itemCount: 3 },
		{ title: 'Desserts', itemCount: 3 },
		{ title: 'After dinner', itemCount: 2 }
	]);
	expect(await page.locator('.wb-restaurant-menu-board__row').count()).toBe(2);
	expect(await page.locator('.wb-restaurant-menu-category').count()).toBe(3);
	expect(await page.locator('.wb-restaurant-menu-item').count()).toBe(8);
	await expect(page.locator('.wb-restaurant-menu-root')).toHaveAttribute('data-transitioning', 'true');
	await page.waitForTimeout(350);
	await expect(page.locator('.wb-restaurant-menu-root')).toHaveAttribute('data-transitioning', 'false');
});

test('keeps pagination functional when motion is off', async ({ page }): Promise<void> => {
	await page.evaluate((): void => {
		(window as ControlledIntervalWindow).__wallboardPreview?.pushConfiguration({ motionPreset: 'off' });
	});
	await expect(page.locator('.wb-restaurant-menu-root')).toHaveAttribute('data-motion-preset', 'off');

	await advanceToFinalPage(page);

	await expect(page.locator('.wb-restaurant-menu-edition em')).toHaveText('2 / 2');
	await expect(page.locator('.wb-restaurant-menu-root')).toHaveAttribute('data-transitioning', 'false');
});

test('cleans the instance-local rotation on destroy', async ({ page }): Promise<void> => {
	await page.evaluate(async (): Promise<void> => {
		await (window as ControlledIntervalWindow).__wallboardPreview?.destroy();
	});

	const active = await page.evaluate((): boolean[] => {
		return ((window as ControlledIntervalWindow).__restaurantMenuIntervals ?? []).map(
			(interval: ControlledInterval): boolean => interval.active
		);
	});

	expect(active.length).toBeGreaterThan(0);
	expect(active.every((value): boolean => !value)).toBe(true);
});

test('keeps uneven final-page categories balanced, contained, and non-overlapping', async ({ page }): Promise<void> => {
	await advanceToFinalPage(page);

	const geometry = await page.evaluate(() => {
		const toRectangle = (element: Element): Rectangle => {
			const rect: DOMRect = element.getBoundingClientRect();

			return {
				bottom: rect.bottom,
				height: rect.height,
				left: rect.left,
				right: rect.right,
				top: rect.top,
				width: rect.width
			};
		};
		const rows: HTMLElement[] = Array.from(document.querySelectorAll<HTMLElement>('.wb-restaurant-menu-board__row'));

		return rows.map((row: HTMLElement) => ({
			rect: toRectangle(row),
			categories: Array.from(row.querySelectorAll<HTMLElement>('.wb-restaurant-menu-category')).map((category: HTMLElement) => ({
				rect: toRectangle(category),
				items: Array.from(category.querySelectorAll<HTMLElement>('.wb-restaurant-menu-item')).map(toRectangle)
			}))
		}));
	});

	expect(geometry.map((row) => row.categories.length)).toEqual([2, 1]);
	const [pairedRow, singleRow] = geometry;
	const [leftCategory, rightCategory] = pairedRow.categories;
	const [singleCategory] = singleRow.categories;
	const categoryRectangles: Rectangle[] = geometry.flatMap((row) => {
		return row.categories.map((category) => category.rect);
	});
	const tolerance = 1;

	expect(Math.abs(leftCategory.rect.width - rightCategory.rect.width)).toBeLessThanOrEqual(tolerance);
	expect(
		Math.max(...categoryRectangles.map((rect: Rectangle): number => rect.height)) -
			Math.min(...categoryRectangles.map((rect: Rectangle): number => rect.height))
	).toBeLessThanOrEqual(tolerance);
	const pairedCategoryWidth: number = leftCategory.rect.width + rightCategory.rect.width;
	const pairedCategoryGap: number = rightCategory.rect.left - leftCategory.rect.right;
	const singleRowTrailingGap: number = singleRow.rect.right - singleCategory.rect.right;

	expect(Math.abs(singleCategory.rect.width - pairedCategoryWidth)).toBeLessThanOrEqual(tolerance);
	expect(Math.abs(singleCategory.rect.left - singleRow.rect.left)).toBeLessThanOrEqual(tolerance);
	expect(Math.abs(singleRowTrailingGap - pairedCategoryGap)).toBeLessThanOrEqual(tolerance);
	expect(pairedCategoryGap).toBeGreaterThan(0);

	for (const row of geometry) {
		for (const category of row.categories) {
			expect(category.rect.left).toBeGreaterThanOrEqual(row.rect.left - tolerance);
			expect(category.rect.right).toBeLessThanOrEqual(row.rect.right + tolerance);
			expect(category.rect.top).toBeGreaterThanOrEqual(row.rect.top - tolerance);
			expect(category.rect.bottom).toBeLessThanOrEqual(row.rect.bottom + tolerance);

			for (const item of category.items) {
				expect(item.left).toBeGreaterThanOrEqual(category.rect.left - tolerance);
				expect(item.right).toBeLessThanOrEqual(category.rect.right + tolerance);
				expect(item.top).toBeGreaterThanOrEqual(category.rect.top - tolerance);
				expect(item.bottom).toBeLessThanOrEqual(category.rect.bottom + tolerance);
			}

			for (let itemIndex = 1; itemIndex < category.items.length; itemIndex += 1) {
				expect(category.items[itemIndex - 1].bottom).toBeLessThanOrEqual(category.items[itemIndex].top + tolerance);
			}
		}
	}

	for (let leftIndex = 0; leftIndex < categoryRectangles.length; leftIndex += 1) {
		for (let rightIndex = leftIndex + 1; rightIndex < categoryRectangles.length; rightIndex += 1) {
			const left: Rectangle = categoryRectangles[leftIndex];
			const right: Rectangle = categoryRectangles[rightIndex];
			const overlapsHorizontally: boolean = left.left < right.right - tolerance && left.right > right.left + tolerance;
			const overlapsVertically: boolean = left.top < right.bottom - tolerance && left.bottom > right.top + tolerance;

			expect(overlapsHorizontally && overlapsVertically).toBe(false);
		}
	}
});

test('keeps its layout isolated from generic editor menu selectors', async ({ page }): Promise<void> => {
	const layoutSnapshot = async (): Promise<string> => {
		return page.locator('.wb-restaurant-menu-root').evaluate((root: Element): string => {
			const selectors: string[] = [
				'.wb-restaurant-menu-header',
				'.wb-restaurant-menu-board__row',
				'.wb-restaurant-menu-category',
				'.wb-restaurant-menu-item'
			];

			return JSON.stringify(selectors.map((selector: string) => {
				return Array.from(root.querySelectorAll<HTMLElement>(selector)).map((element: HTMLElement) => {
					const rect: DOMRect = element.getBoundingClientRect();

					return [rect.left, rect.top, rect.width, rect.height];
				});
			}));
		});
	};
	const firstPageBefore: string = await layoutSnapshot();

	await page.addStyleTag({
		content: [
			'.wb-app { display: inline !important; }',
			'.menu-header { position: absolute !important; }',
			'.menu-board { display: flex !important; }',
			'.menu-category { width: 50% !important; max-width: 50% !important; }',
			'.menu-item { display: inline !important; }'
		].join('\n')
	});

	await expect(page.locator('.wb-app, .menu-header, .menu-board, .menu-category, .menu-item')).toHaveCount(0);
	expect(await layoutSnapshot()).toBe(firstPageBefore);

	await advanceToFinalPage(page);
	await expect(page.locator('.wb-restaurant-menu-category')).toHaveCount(3);
	await expect(page.locator('.wb-restaurant-menu-item')).toHaveCount(8);
});
