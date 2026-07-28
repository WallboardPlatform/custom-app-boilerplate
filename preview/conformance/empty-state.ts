import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { fontFloor } from '../legibility';
import type { ViewingDistance } from '../legibility';

/**
 * Conformance suite for the empty-state archetype.
 *
 * `widget-best-practices.md` states the rule — "do not let a missing datasource produce a blank
 * widget unless blank is the explicit user requirement" — and nothing checked it. An empty
 * signage surface is indistinguishable from a crashed player or a dead screen, so the failure is
 * expensive and silent.
 *
 * Constrains behaviour, never appearance: what the empty state says and how it looks is the
 * app's, that it says something legible and keeps the app identifiable is not.
 */

export interface EmptyStateConformanceTarget {
	/** Human name used in test titles. */
	name: string;
	/** Navigates to the app with its datasource empty. */
	open: (page: Page) => Promise<void>;
	/** The widget root. */
	root: (page: Page) => Locator;
	/**
	 * Something that still identifies the app while it has no data — a masthead, venue name or
	 * board title. Omit only when the brief deliberately renders the message alone.
	 */
	identity?: (page: Page) => Locator;
	/**
	 * The empty-state message itself. Required, and deliberately not inferred from the root: an
	 * earlier version of this suite measured the largest text anywhere in the widget, which is
	 * always the app title, so the legibility assertion could never fail.
	 */
	message: (page: Page) => Locator;
	/** Viewing context the app declares, used to pick the legibility floor. */
	viewing: ViewingDistance;
}

/** Ignores whitespace-only text nodes so a stray non-breaking space cannot pass as content. */
const visibleText = async (locator: Locator): Promise<string> => {
	return (await locator.innerText()).replace(/\s+/g, ' ').trim();
};

/**
 * The assertions, separated from their registration, so a gate test can drive them against
 * deliberately non-conforming DOM. An earlier version of this suite measured the largest text
 * anywhere in the widget -- always the app title -- so its legibility assertion could not fail.
 */
export const assertEmptyStateIsNotBlank = async (
	target: EmptyStateConformanceTarget,
	page: Page
): Promise<void> => {
	// A blank signage surface reads as a broken player, not as "no data".
	await target.open(page);

	const text: string = await visibleText(target.root(page));

	expect(text.length, 'the empty state renders no visible text at all').toBeGreaterThan(0);
};

export const assertEmptyStateIdentifiesTheApp = async (
	target: EmptyStateConformanceTarget,
	page: Page
): Promise<void> => {
	const identity = target.identity;

	if (!identity) {
		return;
	}

	await target.open(page);
	await expect(identity(page)).toBeVisible();
};

export const assertEmptyMessageIsLegible = async (
	target: EmptyStateConformanceTarget,
	page: Page
): Promise<void> => {
	// Empty-state copy is routinely left at metadata size, which is unreadable from the
	// distance the rest of the app was designed for.
	await target.open(page);

	const message: Locator = target.message(page);

	await expect(message).toBeVisible();
	expect((await visibleText(message)).length, 'the empty-state message is blank').toBeGreaterThan(0);

	const floor: number = fontFloor(target.viewing, 'secondary');
	const leading: number = await message.evaluate((element: Element): number => {
		const candidates: Element[] = [element, ...Array.from(element.querySelectorAll('*'))];
		let maximum = 0;

		for (const candidate of candidates) {
			const hasOwnText: boolean = Array.from(candidate.childNodes).some((node: ChildNode): boolean => {
				return node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0;
			});

			if (!hasOwnText) continue;
			maximum = Math.max(maximum, Number.parseFloat(getComputedStyle(candidate).fontSize) || 0);
		}

		return maximum;
	});

	expect(leading, `leading empty-state text is ${leading}px, floor is ${floor}px`).toBeGreaterThanOrEqual(floor);
};

export const assertEmptyStateFillsTheSurface = async (
	target: EmptyStateConformanceTarget,
	page: Page
): Promise<void> => {
	await target.open(page);

	const root: Locator = target.root(page);
	const box = await root.boundingBox();

	expect(box).not.toBeNull();

	const painted: number = await root.evaluate((element: Element): number => {
		const bounds: DOMRect = element.getBoundingClientRect();
		let covered = 0;

		for (const child of Array.from(element.querySelectorAll('*'))) {
			const rect: DOMRect = child.getBoundingClientRect();
			const style: CSSStyleDeclaration = getComputedStyle(child);

			if (style.visibility === 'hidden' || style.display === 'none' || rect.width === 0) continue;
			covered = Math.max(covered, (rect.bottom - bounds.top) / Math.max(bounds.height, 1));
		}

		return covered;
	});

	// Content reaching less than a fifth of the way down means everything is clustered at
	// the top edge with the rest of the surface abandoned.
	expect(painted, 'empty-state content is orphaned against the top edge').toBeGreaterThan(0.2);
};

export const registerEmptyStateConformance = (target: EmptyStateConformanceTarget): void => {
	test.describe(`empty-state conformance: ${target.name}`, (): void => {
		test('an empty datasource does not produce a blank surface', async ({ page }): Promise<void> => {
			await assertEmptyStateIsNotBlank(target, page);
		});

		test('the empty state still identifies the app', async ({ page }): Promise<void> => {
			if (!target.identity) {
				test.skip(true, 'app deliberately renders the empty message alone');

				return;
			}

			await assertEmptyStateIdentifiesTheApp(target, page);
		});

		test('the empty message is legible at the declared viewing distance', async ({ page }): Promise<void> => {
			await assertEmptyMessageIsLegible(target, page);
		});

		test('the empty state fills the surface rather than orphaning text in a corner', async ({ page }): Promise<void> => {
			await assertEmptyStateFillsTheSurface(target, page);
		});
	});
};
