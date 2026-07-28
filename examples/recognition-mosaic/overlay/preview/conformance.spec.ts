import sampleDatasource from '../sample-datasource.json';
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { registerPaginationConformance } from './conformance/pagination';

interface ControlledInterval {
	active: boolean;
	id: number;
	invoke: () => void;
}

interface RecognitionPreviewWindow extends Window {
	__recognitionIntervals?: ControlledInterval[];
}

/**
 * Replaces the rotation timer with one the test drives, so paging is stepped deterministically
 * rather than waited on.
 */
const installControlledRotation = async (page: Page): Promise<void> => {
	await page.addInitScript((): void => {
		const previewWindow: RecognitionPreviewWindow = window as RecognitionPreviewWindow;
		const nativeSetInterval: typeof window.setInterval = window.setInterval.bind(window);
		const intervals: ControlledInterval[] = [];

		previewWindow.__recognitionIntervals = intervals;
		// Matches the page-rotation delay exactly. A looser filter also captures the clock tick,
		// and invoking that advances nothing.
		window.setInterval = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]): number => {
			if (typeof handler === 'function' && (timeout ?? 0) === 3000) {
				const interval: ControlledInterval = {
					active: true,
					id: 8100 + intervals.length,
					invoke: (): void => handler(...rest)
				};

				intervals.push(interval);

				return interval.id;
			}

			return nativeSetInterval(handler, timeout, ...rest);
		}) as typeof window.setInterval;
	});
};

const readNumber = async (page: Page, attribute: string): Promise<number> => {
	const raw: string | null = await page.locator('.wb-app').first().getAttribute(attribute);

	return Number.parseInt(raw ?? '0', 10);
};

registerPaginationConformance({
	name: 'Recognition mosaic',
	open: async (page: Page): Promise<void> => {
		await installControlledRotation(page);
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?scenario=prime-seven&background=light');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	},
	advance: async (page: Page): Promise<void> => {
		const before: number = await readNumber(page, 'data-page-index');

		await page.evaluate((): void => {
			const interval = (window as RecognitionPreviewWindow).__recognitionIntervals?.[0];

			if (!interval?.active) throw new Error('Recognition mosaic did not register an active page interval.');
			interval.invoke();
		});
		await page.waitForFunction(
			(previous: number): boolean => {
				const root: Element | null = document.querySelector('.wb-app');

				return Number.parseInt(root?.getAttribute('data-page-index') ?? '0', 10) !== previous;
			},
			before
		);
	},
	pageCount: async (page: Page): Promise<number> => readNumber(page, 'data-page-count'),
	pageIndex: async (page: Page): Promise<number> => readNumber(page, 'data-page-index'),
	visibleKeys: async (page: Page): Promise<string[]> => {
		return page.locator('.recognition-card').evaluateAll((cards: Element[]): string[] => {
			return cards.map((card: Element): string => card.getAttribute('data-person') ?? '');
		});
	},
	/*
	 * Read from the same sample datasource the scenario is built from, rather than from anything the
	 * app renders: the point is to catch a record the app never put on a page, so the expectation has
	 * to come from outside the app.
	 */
	expectedKeys: async (): Promise<string[]> => {
		return sampleDatasource.Recognitions.rows.map((row: { name: string }): string => row.name);
	}
});
