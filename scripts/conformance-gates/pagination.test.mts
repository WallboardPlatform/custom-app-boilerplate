import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

import {
	assertCycleReturnsToStart,
	assertEveryRecordShownOncePerCycle,
	assertNoEmptyPage
} from '../../preview/conformance/pagination.ts';
import type { PaginationConformanceTarget } from '../../preview/conformance/pagination.ts';

/**
 * Proves the pagination conformance suite can fail.
 *
 * The suite exists to catch a pager that silently drops or repeats a record — a board that looks
 * entirely correct while telling people the wrong thing. But it only ever runs against apps that
 * already work, so a suite that cannot detect the defect is indistinguishable from one that has
 * simply never met it. Two conformance suites in this repository turned out to be the former.
 *
 * Each case therefore drives the real assertions against a synthetic pager, once conforming and
 * once deliberately broken, and requires the broken one to be rejected.
 */

interface PagerOptions {
	/** Records the pager holds. */
	records: number;
	/** Records shown per page. */
	perPage: number;
	/** Skip this record index entirely — the silent drop. */
	dropIndex?: number;
	/** Report more pages than the pager can fill. */
	phantomPages?: number;
	/** Advance by this many pages instead of one. */
	step?: number;
	/** Let the page index run past the last page instead of wrapping, modelling a runaway pager. */
	noWrap?: boolean;
}

let browser: Browser;
let page: Page;

const buildTarget = (options: PagerOptions): PaginationConformanceTarget => {
	const keys: string[] = Array.from({ length: options.records }, (unused: unknown, index: number): string => {
		return `record-${index}`;
	}).filter((unused: string, index: number): boolean => index !== options.dropIndex);
	const pages: number = options.phantomPages ?? Math.ceil(keys.length / options.perPage);
	let index = 0;

	return {
		name: 'synthetic pager',
		open: async (): Promise<void> => {
			index = 0;
			await page.setContent('<body><main id="pager"></main></body>');
		},
		advance: (): Promise<void> => {
			const next: number = index + (options.step ?? 1);

			index = options.noWrap ? next : next % Math.max(pages, 1);

			return Promise.resolve();
		},
		pageCount: (): Promise<number> => Promise.resolve(pages),
		pageIndex: (): Promise<number> => Promise.resolve(index),
		visibleKeys: (): Promise<string[]> => {
			return Promise.resolve(keys.slice(index * options.perPage, (index + 1) * options.perPage));
		},
		// Always the full set the pager was handed, including any record it drops.
		expectedKeys: (): Promise<string[]> => {
			return Promise.resolve(
				Array.from({ length: options.records }, (unused: unknown, at: number): string => `record-${at}`)
			);
		}
	};
};

const rejects = async (run: () => Promise<void>): Promise<boolean> => {
	try {
		await run();

		return false;
	} catch {
		return true;
	}
};

void describe('pagination conformance gate', (): void => {
	before(async (): Promise<void> => {
		browser = await chromium.launch();
		page = await browser.newPage();
	});

	after(async (): Promise<void> => {
		await browser?.close();
	});

	void it('accepts a pager that shows every record once', async (): Promise<void> => {
		const target: PaginationConformanceTarget = buildTarget({ records: 9, perPage: 3 });

		await assertNoEmptyPage(target, page);
		await assertCycleReturnsToStart(target, page);
		await assertEveryRecordShownOncePerCycle(target, page);
	});

	void it('rejects a pager that silently drops a record', async (): Promise<void> => {
		// The defect the suite exists for: nine records, one never scheduled into any page.
		const target: PaginationConformanceTarget = buildTarget({ records: 9, perPage: 3, dropIndex: 4 });

		assert.ok(
			await rejects((): Promise<void> => assertEveryRecordShownOncePerCycle(target, page)),
			'a dropped record must fail the cycle assertion'
		);
	});

	void it('rejects a pager that repeats a record within one cycle', async (): Promise<void> => {
		// Four pages advanced two at a time visits 0, 2, 0, 2 — page 1 and 3 are never shown, and
		// everything on 0 and 2 is shown twice.
		const target: PaginationConformanceTarget = buildTarget({ records: 12, perPage: 3, step: 2 });

		assert.ok(
			await rejects((): Promise<void> => assertEveryRecordShownOncePerCycle(target, page)),
			'a repeated record must fail the cycle assertion'
		);
	});

	void it('rejects a pager that claims a page it cannot fill', async (): Promise<void> => {
		const target: PaginationConformanceTarget = buildTarget({ records: 6, perPage: 3, phantomPages: 4 });

		assert.ok(
			await rejects((): Promise<void> => assertNoEmptyPage(target, page)),
			'an empty page must fail the empty-page assertion'
		);
	});

	void it('rejects a pager that never returns to where it started', async (): Promise<void> => {
		const target: PaginationConformanceTarget = buildTarget({ records: 9, perPage: 3, noWrap: true });

		assert.ok(
			await rejects((): Promise<void> => assertCycleReturnsToStart(target, page)),
			'a drifting cycle must fail the return-to-start assertion'
		);
	});

	void it('rejects a pager that reports no pages at all', async (): Promise<void> => {
		const target: PaginationConformanceTarget = buildTarget({ records: 0, perPage: 3 });

		assert.ok(
			await rejects((): Promise<void> => assertNoEmptyPage(target, page)),
			'a pager with no pages must fail rather than vacuously pass'
		);
	});
});
