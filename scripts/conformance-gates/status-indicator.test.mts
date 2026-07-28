import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { chromium } from '@playwright/test';
import type { Browser, Locator, Page } from '@playwright/test';

import {
	assertStateIsNotColourAlone,
	assertStateTextIsLegible
} from '../../preview/conformance/status-indicator.ts';
import type { StatusIndicatorConformanceTarget } from '../../preview/conformance/status-indicator.ts';

/**
 * Proves the status-indicator conformance suite can fail.
 *
 * This suite has already been wrong once: it accepted any text anywhere inside an indicator, so a
 * row carrying a station name and a timestamp passed with its state label deleted. That was found
 * by reading the code, not by any test, which is the problem this file exists to remove.
 */

interface IndicatorSpec {
	state: string;
	label?: string;
	labelColour?: string;
	background?: string;
}

let browser: Browser;
let page: Page;

const buildTarget = (indicators: IndicatorSpec[], selector = '.indicator'): StatusIndicatorConformanceTarget => ({
	name: 'synthetic indicators',
	open: async (): Promise<void> => {
		const markup: string = indicators.map((spec: IndicatorSpec): string => {
			const label: string = spec.label === undefined
				? ''
				: `<span class="state-label" style="color:${spec.labelColour ?? '#ffffff'}">${spec.label}</span>`;

			return `<div class="indicator" data-state="${spec.state}" `
				+ `style="background:${spec.background ?? '#333333'}">`
				+ `<span class="who">Lane ${spec.state}</span>${label}</div>`;
		}).join('');

		await page.setContent(`<body style="background:#ffffff">${markup}</body>`);
	},
	indicators: (target: Page): Locator => target.locator(selector),
	stateAttribute: 'data-state',
	stateLabel: (indicator: Locator): Locator => indicator.locator('.state-label')
});

const rejects = async (run: () => Promise<void>): Promise<boolean> => {
	try {
		await run();

		return false;
	} catch {
		return true;
	}
};

void describe('status-indicator conformance gate', (): void => {
	before(async (): Promise<void> => {
		browser = await chromium.launch();
		page = await browser.newPage();
	});

	after(async (): Promise<void> => {
		await browser?.close();
	});

	void it('accepts indicators that name each state in words', async (): Promise<void> => {
		const target: StatusIndicatorConformanceTarget = buildTarget([
			{ state: 'running', label: 'Running', background: '#1d6b2f' },
			{ state: 'stopped', label: 'Stopped', background: '#8a1c1c' }
		]);

		await assertStateIsNotColourAlone(target, page);
		await assertStateTextIsLegible(target, page);
	});

	void it('rejects a state signalled by colour with no words', async (): Promise<void> => {
		const target: StatusIndicatorConformanceTarget = buildTarget([
			{ state: 'running', label: 'Running', background: '#1d6b2f' },
			{ state: 'stopped', background: '#8a1c1c' }
		]);

		assert.ok(
			await rejects((): Promise<void> => assertStateIsNotColourAlone(target, page)),
			'a state with no label must fail'
		);
	});

	void it('rejects distinct states that read identically', async (): Promise<void> => {
		// Same word on both: the text is decoration and the colour is still doing the work.
		const target: StatusIndicatorConformanceTarget = buildTarget([
			{ state: 'running', label: 'Line 4', background: '#1d6b2f' },
			{ state: 'stopped', label: 'Line 4', background: '#8a1c1c' }
		]);

		assert.ok(
			await rejects((): Promise<void> => assertStateIsNotColourAlone(target, page)),
			'two states sharing one label must fail'
		);
	});

	void it('rejects state text that has collapsed against its own chip', async (): Promise<void> => {
		const target: StatusIndicatorConformanceTarget = buildTarget([
			{ state: 'warning', label: 'Warning', background: '#d8c98a', labelColour: '#e4dcbb' }
		]);

		assert.ok(
			await rejects((): Promise<void> => assertStateTextIsLegible(target, page)),
			'low-contrast state text must fail'
		);
	});

	void it('rejects a selector that matches no indicator at all', async (): Promise<void> => {
		// The vacuous pass: with nothing selected, a per-indicator loop has nothing to check and
		// reports success. A wrong selector must fail loudly rather than silently verify nothing.
		const target: StatusIndicatorConformanceTarget = buildTarget(
			[{ state: 'running', label: 'Running' }],
			'.no-such-indicator'
		);

		assert.ok(
			await rejects((): Promise<void> => assertStateIsNotColourAlone(target, page)),
			'an empty indicator set must fail the colour-alone assertion'
		);
		assert.ok(
			await rejects((): Promise<void> => assertStateTextIsLegible(target, page)),
			'an empty indicator set must fail the contrast assertion'
		);
	});
});
