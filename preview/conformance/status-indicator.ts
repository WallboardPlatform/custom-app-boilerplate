import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Conformance suite for the status-indicator archetype.
 *
 * Signage encodes state with colour constantly — a stopped line, a delayed flight, an agent on a
 * call. Colour alone excludes roughly one viewer in twelve, and it survives none of the
 * conditions signage actually runs in: a washed-out panel in sunlight, a miscalibrated screen, a
 * greyscale photo of the board in a report.
 *
 * Constrains behaviour, never appearance: which hues mean what is the app's, that the meaning
 * survives without them is not.
 */

export interface StatusIndicatorConformanceTarget {
	/** Human name used in test titles. */
	name: string;
	/** Navigates to a state where the indicators are visible. */
	open: (page: Page) => Promise<void>;
	/**
	 * Elements that carry a machine-readable state, typically via a `data-` attribute. Each is
	 * expected to convey that state in text as well as in colour.
	 */
	indicators: (page: Page) => Locator;
	/** Attribute holding the state, used to report which state failed. */
	stateAttribute: string;
	/**
	 * The element inside an indicator that names the state in words. Required, and deliberately
	 * not inferred: an earlier version accepted any text anywhere in the indicator, so a row
	 * carrying a station name and a timestamp passed even with its state label deleted.
	 */
	stateLabel: (indicator: Locator) => Locator;
	/** Minimum contrast for the state text against its own background. */
	minimumContrast?: number;
}

const relativeLuminance = (rgb: readonly number[]): number => {
	const channels: number[] = rgb.map((value: number): number => {
		const ratio: number = value / 255;

		return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
};

const parseRgb = (value: string): number[] | undefined => {
	const match: RegExpMatchArray | null = value.match(/rgba?\(([^)]+)\)/);

	if (!match) return undefined;

	const parts: number[] = (match[1] ?? '').split(',').map((part: string): number => Number.parseFloat(part));

	return parts.length >= 3 ? parts.slice(0, 3) : undefined;
};

/**
 * The assertions, separated from their registration, so a gate test can drive them against
 * deliberately non-conforming DOM. An earlier version of this suite accepted any text anywhere in
 * an indicator, which meant it could not fail; nothing caught that except reading it.
 */
export const assertStateIsNotColourAlone = async (
	target: StatusIndicatorConformanceTarget,
	page: Page
): Promise<void> => {
	await target.open(page);

	const indicators: Locator = target.indicators(page);
	const total: number = await indicators.count();

	expect(total, 'no status indicators found; check the selector').toBeGreaterThan(0);

	const wording = new Map<string, string>();

	for (let index = 0; index < total; index += 1) {
		const indicator: Locator = indicators.nth(index);
		const state: string = (await indicator.getAttribute(target.stateAttribute)) ?? '(unset)';
		const label: Locator = target.stateLabel(indicator).first();
		const text: string = (await label.count()) > 0
			? ((await label.getAttribute('aria-label')) ?? await label.innerText()).replace(/\s+/g, ' ').trim()
			: '';

		expect(text.length, `state "${state}" is signalled without any words`).toBeGreaterThan(0);
		wording.set(state, text);
	}

	// Distinct states reading identically means the words are decoration and the colour is
	// still doing the work.
	const distinctStates: number = wording.size;
	const distinctWords: number = new Set(wording.values()).size;

	expect(
		distinctWords,
		`${distinctStates} states share only ${distinctWords} distinct labels: ${JSON.stringify([...wording])}`
	).toBe(distinctStates);
};

export const assertStateTextIsLegible = async (
	target: StatusIndicatorConformanceTarget,
	page: Page
): Promise<void> => {
	const minimumContrast: number = target.minimumContrast ?? 3;

	// A status chip commonly tints its own background, which is where contrast quietly
	// collapses even though the surrounding surface is fine.
	await target.open(page);

	const indicators: Locator = target.indicators(page);
	const total: number = await indicators.count();

	expect(total, 'no status indicators found; check the selector').toBeGreaterThan(0);

	for (let index = 0; index < total; index += 1) {
		const indicator: Locator = indicators.nth(index);
		const state: string = (await indicator.getAttribute(target.stateAttribute)) ?? '(unset)';
		/*
		 * Measured on the state label, not on the indicator that contains it. Reading the container's
		 * computed colour describes whatever the chip inherits, which is not necessarily the colour
		 * the state word is actually painted in -- the same wrong-element mistake that once let this
		 * suite pass an indicator whose state label had been deleted.
		 */
		const label: Locator = target.stateLabel(indicator).first();

		if (await label.count() === 0) {
			continue;
		}

		const colours = await label.evaluate((element: Element): { background: string; text: string } => {
			const style: CSSStyleDeclaration = getComputedStyle(element);
			let background: string = style.backgroundColor;
			let node: Element | null = element;

			// Walk up while the background is transparent, as a chip often inherits it.
			while (node && (background === 'rgba(0, 0, 0, 0)' || background === 'transparent')) {
				node = node.parentElement;
				background = node ? getComputedStyle(node).backgroundColor : 'rgb(255, 255, 255)';
			}

			return { background, text: style.color };
		});

		const background: number[] | undefined = parseRgb(colours.background);
		const text: number[] | undefined = parseRgb(colours.text);

		if (!background || !text) continue;

		const lighter: number = Math.max(relativeLuminance(background), relativeLuminance(text));
		const darker: number = Math.min(relativeLuminance(background), relativeLuminance(text));
		const ratio: number = (lighter + 0.05) / (darker + 0.05);

		expect(
			Number(ratio.toFixed(2)),
			`state "${state}" renders ${colours.text} on ${colours.background}`
		).toBeGreaterThanOrEqual(minimumContrast);
	}
};

export const registerStatusIndicatorConformance = (target: StatusIndicatorConformanceTarget): void => {
	test.describe(`status-indicator conformance: ${target.name}`, (): void => {
		test('state is never conveyed by colour alone', async ({ page }): Promise<void> => {
			await assertStateIsNotColourAlone(target, page);
		});

		test('state text stays legible against its own background', async ({ page }): Promise<void> => {
			await assertStateTextIsLegible(target, page);
		});
	});
};
