import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { chromium } from '@playwright/test';
import type { Browser, Locator, Page } from '@playwright/test';

import {
	assertEmptyMessageIsLegible,
	assertEmptyStateFillsTheSurface,
	assertEmptyStateIdentifiesTheApp,
	assertEmptyStateIsNotBlank
} from '../../preview/conformance/empty-state.ts';
import type { EmptyStateConformanceTarget } from '../../preview/conformance/empty-state.ts';

/**
 * Proves the empty-state conformance suite can fail.
 *
 * This suite has already been wrong once: its legibility assertion measured the largest text
 * anywhere in the widget, which is always the app title, so it passed however small the empty
 * message was set. That was found by reading the code rather than by any test, which is exactly
 * the gap these cases close.
 */

interface EmptyStateSpec {
	/** Rendered message, or empty for a blank surface. */
	message: string;
	/** Font size of the message in px. */
	messageSize: number;
	/** Render a masthead that keeps the app identifiable. */
	identity: boolean;
	/** Pin content against the top edge instead of filling the surface. */
	orphaned?: boolean;
}

let browser: Browser;
let page: Page;

const buildTarget = (spec: EmptyStateSpec): EmptyStateConformanceTarget => ({
	name: 'synthetic empty state',
	open: async (): Promise<void> => {
		const identity: string = spec.identity
			? '<h1 class="masthead" style="margin:0;font-size:64px">Departures</h1>'
			: '';
		const message: string = spec.message
			? `<p class="empty-message" style="margin:0;font-size:${spec.messageSize}px">${spec.message}</p>`
			: '';
		const layout: string = spec.orphaned
			? 'display:block'
			: 'display:flex;flex-direction:column;align-items:center;justify-content:center';

		await page.setContent(
			'<body style="margin:0">'
			+ `<div class="root" style="width:800px;height:600px;${layout}">${identity}${message}</div>`
			+ '</body>'
		);
	},
	root: (target: Page): Locator => target.locator('.root'),
	identity: spec.identity ? (target: Page): Locator => target.locator('.masthead') : undefined,
	message: (target: Page): Locator => target.locator('.empty-message'),
	viewing: 'room'
});

const rejects = async (run: () => Promise<void>): Promise<boolean> => {
	try {
		await run();

		return false;
	} catch {
		return true;
	}
};

void describe('empty-state conformance gate', (): void => {
	before(async (): Promise<void> => {
		browser = await chromium.launch();
		page = await browser.newPage({ viewport: { width: 800, height: 600 } });
	});

	after(async (): Promise<void> => {
		await browser?.close();
	});

	void it('accepts an empty state that says something, legibly, across the surface', async (): Promise<void> => {
		const target: EmptyStateConformanceTarget = buildTarget({
			message: 'No departures are scheduled right now.',
			messageSize: 40,
			identity: true
		});

		await assertEmptyStateIsNotBlank(target, page);
		await assertEmptyStateIdentifiesTheApp(target, page);
		await assertEmptyMessageIsLegible(target, page);
		await assertEmptyStateFillsTheSurface(target, page);
	});

	void it('rejects a blank surface', async (): Promise<void> => {
		// A blank signage surface reads as a broken player, not as "no data".
		const target: EmptyStateConformanceTarget = buildTarget({ message: '', messageSize: 40, identity: false });

		assert.ok(
			await rejects((): Promise<void> => assertEmptyStateIsNotBlank(target, page)),
			'a surface with no text must fail'
		);
	});

	void it('rejects an empty message left at metadata size', async (): Promise<void> => {
		// The defect the suite was rewritten for: a large title alongside a tiny message used to
		// pass, because the largest text in the widget was measured rather than the message.
		const target: EmptyStateConformanceTarget = buildTarget({
			message: 'No departures are scheduled right now.',
			messageSize: 11,
			identity: true
		});

		assert.ok(
			await rejects((): Promise<void> => assertEmptyMessageIsLegible(target, page)),
			'an empty message below the room-distance floor must fail even beside a large title'
		);
	});

	void it('rejects an empty state orphaned against the top edge', async (): Promise<void> => {
		const target: EmptyStateConformanceTarget = buildTarget({
			message: 'No departures.',
			messageSize: 40,
			identity: false,
			orphaned: true
		});

		assert.ok(
			await rejects((): Promise<void> => assertEmptyStateFillsTheSurface(target, page)),
			'content clustered at the top edge must fail'
		);
	});

	void it('rejects an app that loses its identity when empty', async (): Promise<void> => {
		// The descriptor still declares an identity element; the app simply stops rendering it.
		const target: EmptyStateConformanceTarget = {
			...buildTarget({ message: 'No departures.', messageSize: 40, identity: false }),
			identity: (target: Page): Locator => target.locator('.masthead')
		};

		assert.ok(
			await rejects((): Promise<void> => assertEmptyStateIdentifiesTheApp(target, page)),
			'a missing masthead must fail'
		);
	});
});
