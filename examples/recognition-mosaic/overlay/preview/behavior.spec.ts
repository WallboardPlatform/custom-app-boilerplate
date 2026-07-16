import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface ControlledInterval {
	active: boolean;
	delay: number;
	id: number;
	invoke: () => void;
}

interface RecognitionPreviewWindow extends Window {
	__recognitionIntervals?: ControlledInterval[];
	__wallboardPreview?: {
		destroy: () => Promise<void>;
	};
}

const installControlledRotation = async (page: Page): Promise<void> => {
	await page.addInitScript((): void => {
		const previewWindow: RecognitionPreviewWindow = window as RecognitionPreviewWindow;
		const nativeSetInterval: typeof window.setInterval = window.setInterval.bind(window);
		const nativeClearInterval: typeof window.clearInterval = window.clearInterval.bind(window);
		const intervals: ControlledInterval[] = [];

		previewWindow.__recognitionIntervals = intervals;
		window.setInterval = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]): number => {
			const delay: number = timeout ?? 0;

			if (delay === 3000 && typeof handler === 'function') {
				const interval: ControlledInterval = {
					active: true,
					delay,
					id: 4100 + intervals.length,
					invoke: (): void => handler(...arguments_)
				};

				intervals.push(interval);

				return interval.id;
			}

			return nativeSetInterval(handler, delay, ...arguments_);
		}) as typeof window.setInterval;
		window.clearInterval = ((id: number | undefined): void => {
			const controlled: ControlledInterval | undefined = intervals.find(
				(interval: ControlledInterval): boolean => interval.id === id
			);

			if (controlled) {
				controlled.active = false;
				return;
			}

			nativeClearInterval(id);
		}) as typeof window.clearInterval;
	});
};

const openPrimeSevenScenario = async (page: Page): Promise<void> => {
	await page.setViewportSize({ width: 1920, height: 1080 });
	const query: URLSearchParams = new URLSearchParams({
		width: '1920',
		height: '1080',
		background: 'light',
		scenario: 'prime-seven'
	});
	const response = await page.goto(`/preview/widget.html?${query.toString()}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	await expect(page.locator('.wb-app')).toHaveAttribute('data-page-count', '2');
	await expect(page.locator('.wb-app')).toHaveAttribute('data-page-index', '0');
};

const advanceRotation = async (page: Page): Promise<void> => {
	await page.evaluate((): void => {
		const previewWindow: RecognitionPreviewWindow = window as RecognitionPreviewWindow;
		const interval: ControlledInterval | undefined = previewWindow.__recognitionIntervals?.[0];

		if (!interval || !interval.active) {
			throw new Error('Recognition mosaic did not register an active page interval.');
		}

		interval.invoke();
	});
};

test.beforeEach(async ({ page }): Promise<void> => {
	await installControlledRotation(page);
	await openPrimeSevenScenario(page);
});

test('rotates balanced prime-count pages and wraps circularly', async ({ page }): Promise<void> => {
	await expect(page.locator('.recognition-card')).toHaveCount(4);
	await expect(page.locator('.recognition-card').first()).toHaveAttribute('data-person', 'Maya Rowan');

	await advanceRotation(page);
	await expect(page.locator('.wb-app')).toHaveAttribute('data-page-index', '1');
	await expect(page.locator('.recognition-card')).toHaveCount(3);
	await expect(page.locator('.recognition-card').first()).toHaveAttribute('data-person', 'Arun Mehta');

	await advanceRotation(page);
	await expect(page.locator('.wb-app')).toHaveAttribute('data-page-index', '0');
	await expect(page.locator('.recognition-card')).toHaveCount(4);
});

test('cleans the instance-local rotation interval on destroy', async ({ page }): Promise<void> => {
	const activeBeforeDestroy: boolean[] = await page.evaluate((): boolean[] => {
		const previewWindow: RecognitionPreviewWindow = window as RecognitionPreviewWindow;

		return (previewWindow.__recognitionIntervals ?? []).map(
			(interval: ControlledInterval): boolean => interval.active
		);
	});

	expect(activeBeforeDestroy).toEqual([true]);
	await page.evaluate(async (): Promise<void> => {
		const previewWindow: RecognitionPreviewWindow = window as RecognitionPreviewWindow;

		if (!previewWindow.__wallboardPreview) {
			throw new Error('Preview destroy API is unavailable.');
		}

		await previewWindow.__wallboardPreview.destroy();
	});

	const activeAfterDestroy: boolean[] = await page.evaluate((): boolean[] => {
		const previewWindow: RecognitionPreviewWindow = window as RecognitionPreviewWindow;

		return (previewWindow.__recognitionIntervals ?? []).map(
			(interval: ControlledInterval): boolean => interval.active
		);
	});

	expect(activeAfterDestroy).toEqual([false]);
	await expect(page.locator('.recognition-card')).toHaveCount(0);
});
