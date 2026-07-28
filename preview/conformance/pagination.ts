import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Conformance suite for the paginated-content archetype.
 *
 * Seven examples page through more records than fit. The failure that matters is not visual: a
 * pager that silently drops a record shows a board which looks entirely correct and is wrong.
 * Nobody watching a departures board can tell that their flight is the one never scheduled into
 * a page.
 *
 * Constrains behaviour, never appearance: how pages are indicated, how they transition and how
 * many rows each holds is the app's; that every record is reachable exactly once is not.
 */

export interface PaginationConformanceTarget {
	/** Human name used in test titles. */
	name: string;
	/** Navigates to the app with rotation under test control. */
	open: (page: Page) => Promise<void>;
	/** Advances exactly one page. */
	advance: (page: Page) => Promise<void>;
	/** Number of pages the app claims to have. */
	pageCount: (page: Page) => Promise<number>;
	/** Zero-based index of the page currently shown. */
	pageIndex: (page: Page) => Promise<number>;
	/** Identity of each record visible on the current page; must be stable across pages. */
	visibleKeys: (page: Page) => Promise<string[]>;
	/**
	 * Identity of every record the app was given, in any order.
	 *
	 * Without this the suite can only compare pages against each other, which catches a repeated
	 * record but never a missing one — and a record that is never scheduled onto any page is the
	 * failure that matters, because the board looks perfectly normal while omitting someone.
	 */
	expectedKeys: (page: Page) => Promise<string[]>;
}

/**
 * The assertions, separated from their registration.
 *
 * A conformance suite that only ever meets conforming apps cannot be distinguished from one that
 * cannot detect a violation — this repository has shipped two of the latter. Exporting the bodies
 * lets `scripts/conformance-gates` drive them against deliberately broken apps and prove each one
 * fails.
 */
export const assertNoEmptyPage = async (target: PaginationConformanceTarget, page: Page): Promise<void> => {
	await target.open(page);

	const pages: number = await target.pageCount(page);

	expect(pages, 'the app reports no pages at all').toBeGreaterThan(0);

	for (let visited = 0; visited < pages; visited += 1) {
		const keys: string[] = await target.visibleKeys(page);

		expect(keys.length, `page ${await target.pageIndex(page)} renders no records`).toBeGreaterThan(0);
		await target.advance(page);
	}
};

export const assertCycleReturnsToStart = async (
	target: PaginationConformanceTarget,
	page: Page
): Promise<void> => {
	await target.open(page);

	const pages: number = await target.pageCount(page);
	const start: number = await target.pageIndex(page);

	for (let visited = 0; visited < pages; visited += 1) {
		await target.advance(page);
	}

	expect(await target.pageIndex(page), 'a full cycle did not return to where it started').toBe(start);
};

export const assertEveryRecordShownOncePerCycle = async (
	target: PaginationConformanceTarget,
	page: Page
): Promise<void> => {
	// The silent one. A pager that drops or repeats a record produces a board that looks
	// completely normal and is telling people the wrong thing.
	await target.open(page);

	const pages: number = await target.pageCount(page);
	const seen: string[] = [];

	for (let visited = 0; visited < pages; visited += 1) {
		seen.push(...await target.visibleKeys(page));
		await target.advance(page);
	}

	const unique = new Set(seen);
	const duplicates: string[] = seen.filter((key: string, index: number): boolean => {
		return seen.indexOf(key) !== index;
	});
	const expected: string[] = await target.expectedKeys(page);
	const missing: string[] = expected.filter((key: string): boolean => !unique.has(key));
	const unexpected: string[] = [...unique].filter((key: string): boolean => !expected.includes(key));

	expect(
		duplicates,
		`records repeated within one cycle: ${JSON.stringify([...new Set(duplicates)])}`
	).toEqual([]);
	expect(
		missing,
		`records never scheduled onto any page: ${JSON.stringify(missing)}`
	).toEqual([]);
	expect(
		unexpected,
		`records shown that the app was never given: ${JSON.stringify(unexpected)}`
	).toEqual([]);
	expect(unique.size, 'a cycle showed no records at all').toBeGreaterThan(0);
};

export const registerPaginationConformance = (target: PaginationConformanceTarget): void => {
	test.describe(`pagination conformance: ${target.name}`, (): void => {
		test('no page is empty while records exist', async ({ page }): Promise<void> => {
			await assertNoEmptyPage(target, page);
		});

		test('a full cycle returns to the first page without drifting', async ({ page }): Promise<void> => {
			await assertCycleReturnsToStart(target, page);
		});

		test('every record is shown exactly once per cycle', async ({ page }): Promise<void> => {
			await assertEveryRecordShownOncePerCycle(target, page);
		});
	});
};
