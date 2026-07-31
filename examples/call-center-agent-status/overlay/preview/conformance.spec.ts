import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import sampleDatasourceJson from '../sample-datasource.json';

import { registerEmptyStateConformance } from './conformance/empty-state';
import { registerPaginationConformance } from './conformance/pagination';
import { registerStatusIndicatorConformance } from './conformance/status-indicator';

const sampleDatasource = sampleDatasourceJson as Array<Record<string, unknown>>;

/*
 * This example is the portfolio's reference for the status-wall mechanism and was not running the
 * status-indicator suite. That is the gap worth closing first: an app others are meant to copy
 * should be the one most certainly conformant, not the one nothing checks.
 */
registerStatusIndicatorConformance({
	name: 'Agent status cards',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?background=dark');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
		await expect(page.locator('.agent-card').first()).toBeVisible();
	},
	indicators: (page: Page): Locator => page.locator('.agent-card'),
	stateAttribute: 'data-agent-tone',
	// The state word, not the card: the card also carries a name, a timer and three metrics, any of
	// which would satisfy a looser "has text somewhere" check while the state itself was missing.
	stateLabel: (indicator: Locator): Locator => indicator.locator('.agent-identity b')
});

interface ControlledInterval {
	active: boolean;
	invoke: () => void;
}

interface RotationWindow extends Window {
	__agentRotationIntervals?: ControlledInterval[];
}

const ROOT = '.wb-app';

/**
 * Replaces the rotation timer with one the test drives.
 *
 * The exclusion this replaces claimed the app needed a hook added for this. It did not: the
 * scheduler is `window.setInterval`, and intercepting it is test-side work, exactly as
 * recognition-mosaic already does. The recorded reason was wrong.
 */
const installControlledRotation = async (page: Page): Promise<void> => {
	await page.addInitScript((): void => {
		const rotationWindow: RotationWindow = window as RotationWindow;
		const nativeSetInterval: typeof window.setInterval = window.setInterval.bind(window);
		const intervals: ControlledInterval[] = [];

		rotationWindow.__agentRotationIntervals = intervals;
		// Matches the page duration exactly. A looser filter also captures unrelated timers, and
		// invoking one of those advances nothing.
		window.setInterval = ((handler: TimerHandler, timeout?: number, ...rest: unknown[]): number => {
			if (typeof handler === 'function' && (timeout ?? 0) === 3000) {
				intervals.push({ active: true, invoke: (): void => handler(...rest) });

				return 9100 + intervals.length;
			}

			return nativeSetInterval(handler, timeout, ...rest);
		}) as typeof window.setInterval;
	});
};

const readNumber = async (page: Page, attribute: string): Promise<number> => {
	const value: string | null = await page.locator(ROOT).getAttribute(attribute);

	return Number.parseInt(value ?? '0', 10);
};

registerPaginationConformance({
	name: 'Agent roster pages',
	traversal: 'rotating',
	open: async (page: Page): Promise<void> => {
		await installControlledRotation(page);
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?background=light');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	},
	advance: async (page: Page): Promise<void> => {
		const before: number = await readNumber(page, 'data-page-index');

		await page.evaluate((): void => {
			const interval = (window as RotationWindow).__agentRotationIntervals?.[0];

			if (!interval?.active) throw new Error('Agent roster did not register a rotation interval.');
			interval.invoke();
		});
		await page.waitForFunction((previous: number): boolean => {
			const root: Element | null = document.querySelector('.wb-app');

			return Number.parseInt(root?.getAttribute('data-page-index') ?? '0', 10) !== previous;
		}, before);
	},
	pageCount: (page: Page): Promise<number> => readNumber(page, 'data-page-count'),
	pageIndex: (page: Page): Promise<number> => readNumber(page, 'data-page-index'),
	visibleKeys: async (page: Page): Promise<string[]> => {
		return page.locator('[data-agent-name]').evaluateAll((cards: Element[]): string[] => {
			return cards.map((card: Element): string => card.getAttribute('data-agent-name') ?? '');
		});
	},
	// From the sample datasource, so a dropped agent is measured against what the app was given.
	expectedKeys: async (): Promise<string[]> => {
		return sampleDatasource.map((row): string => String(row.Name));
	}
});

/*
 * An empty datasource is the state a customer is most certain to meet and the author least likely
 * to have looked at: no data on the first day, nothing after a filter, a source down at 3am. The
 * suite requires the surface to still say something legible rather than going blank.
 */
registerEmptyStateConformance({
	name: 'Call center agent status',
	open: async (page: Page): Promise<void> => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		const response = await page.goto('/preview/widget.html?scenario=empty&background=light');

		expect(response?.ok()).toBe(true);
		await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
	},
	root: (page: Page): Locator => page.locator('.wb-app'),
	// The message itself, not the surface around it: measuring the container reintroduces the defect
	// this suite was rewritten for, where the largest text nearby passed for the empty copy.
	message: (page: Page): Locator => page.locator('.agent-empty'),
	viewing: 'room'
});
