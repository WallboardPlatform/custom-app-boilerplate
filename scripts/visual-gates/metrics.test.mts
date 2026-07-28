import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

import { collectVisualMetrics } from '../../preview/visual-metrics.ts';
import type { VisualMetrics } from '../../preview/visual-metrics.ts';

/**
 * Proves the visual gate can fail.
 *
 * Every assertion in `preview/visual.spec.ts` exists to catch a defect, but each one runs only
 * against whatever the examples happen to render. A gate that never meets a violation looks
 * identical to a gate that cannot detect one, and this repository has shipped both: a text-fit
 * safety margin that could only ever reject, two conformance suites that measured the wrong
 * element, and a broken-image check that was blind to broken images while failing intermittently
 * on working ones.
 *
 * So each case here mounts DOM that violates one metric and asserts the metric reports it, paired
 * with a clean control asserting it stays quiet. A metric that cannot be made to fire here is a
 * finding, not a passing test.
 */

const ROOT_STYLE = 'position:relative;width:600px;height:400px;overflow:hidden;font:16px/1.4 Arial;';

/*
 * The collector is compiled by tsx before Playwright serialises it into the page, and that compiler
 * wraps inner declarations in its `__name` helper to preserve function names. The helper is a
 * module-scope import that does not travel with the serialised source, so the page needs an
 * identity stand-in. It ships inside the page markup because an init script does not survive
 * `setContent`, and because anything compiled would need the same helper it is meant to supply.
 */
const NAME_HELPER_SHIM = '<script>globalThis.__name = globalThis.__name || (function (value) { return value; });</scr' + 'ipt>';

let browser: Browser;
let page: Page;

const measure = async (bodyHtml: string): Promise<VisualMetrics> => {
	await page.setContent(
		`<body style="margin:0">${NAME_HELPER_SHIM}`
		+ `<div id="wallboard-preview-root" style="${ROOT_STYLE}">${bodyHtml}</div></body>`
	);

	return page.evaluate(collectVisualMetrics);
};

void describe('visual metrics gate', (): void => {
	before(async (): Promise<void> => {
		browser = await chromium.launch();
		page = await browser.newPage({ viewport: { width: 800, height: 600 } });
	});

	after(async (): Promise<void> => {
		await browser?.close();
	});

	void it('stays quiet on content that fits', async (): Promise<void> => {
		const metrics: VisualMetrics = await measure('<p style="margin:0;width:200px">Fits comfortably.</p>');

		assert.deepEqual(metrics.horizontalOverflow, []);
		assert.deepEqual(metrics.verticalOverflow, []);
		assert.deepEqual(metrics.outsideRoot, []);
		assert.deepEqual(metrics.brokenImages, []);
		assert.ok(metrics.visibleLeafNodes > 0, 'clean content must still register visible leaves');
	});

	void it('reports text wider than its own box', async (): Promise<void> => {
		const metrics: VisualMetrics = await measure(
			'<div class="too-narrow" style="width:80px;overflow:hidden;white-space:nowrap">'
			+ 'A line far wider than eighty pixels of box</div>'
		);

		assert.ok(
			metrics.horizontalOverflow.some((entry: string): boolean => entry.includes('too-narrow')),
			`expected horizontal overflow, got ${JSON.stringify(metrics.horizontalOverflow)}`
		);
	});

	void it('reports a container taller than its own box', async (): Promise<void> => {
		// Deliberately a container: the metric requires child elements, because a bare text leaf that
		// overflows is the ink-safety check's job, not this one.
		const metrics: VisualMetrics = await measure(
			'<div class="too-short" style="width:200px;height:24px;overflow:hidden">'
			+ '<p style="margin:0">One two three four five</p><p style="margin:0">six seven eight nine</p></div>'
		);

		assert.ok(
			metrics.verticalOverflow.some((entry: string): boolean => entry.includes('too-short')),
			`expected vertical overflow, got ${JSON.stringify(metrics.verticalOverflow)}`
		);
	});

	void it('reports an element pushed outside the root', async (): Promise<void> => {
		const metrics: VisualMetrics = await measure(
			'<div class="escapee" style="position:absolute;left:900px;top:10px;width:120px;height:40px;background:#333"></div>'
		);

		assert.ok(
			metrics.outsideRoot.some((entry: string): boolean => entry.includes('escapee')),
			`expected an outside-root report, got ${JSON.stringify(metrics.outsideRoot)}`
		);
	});

	void it('reports a broken image the widget left on screen', async (): Promise<void> => {
		const metrics: VisualMetrics = await measure(
			'<img class="left-broken" src="data:image/png;base64,invalid" alt="" style="width:120px;height:80px">'
		);

		assert.ok(
			metrics.brokenImages.some((entry: string): boolean => entry.includes('left-broken')),
			`expected a broken-image report, got ${JSON.stringify(metrics.brokenImages)}`
		);
	});

	void it('stays quiet on a broken image the widget hid behind a fallback', async (): Promise<void> => {
		// recognition-mosaic's designed behaviour: the failed image stays in the DOM, hidden, with a
		// fallback drawn over it. Handling a failure is not a defect.
		const metrics: VisualMetrics = await measure(
			'<img class="handled" src="data:image/png;base64,invalid" alt="" style="visibility:hidden">'
			+ '<div class="initials">AB</div>'
		);

		assert.deepEqual(metrics.brokenImages, []);
	});

	void it('stays quiet on a broken image the widget removed', async (): Promise<void> => {
		// newsroom-spotlight's designed behaviour: swap the image out for a fallback element.
		const metrics: VisualMetrics = await measure('<div class="media-fallback">Category</div>');

		assert.deepEqual(metrics.brokenImages, []);
	});

	void it('measures content coverage against the root box', async (): Promise<void> => {
		// Text, not a background colour: a filled rectangle is not content, and coverage is
		// deliberately a measure of ink rather than of paint.
		const sparse: VisualMetrics = await measure(
			'<div style="position:absolute;left:0;top:0;width:60px;height:40px">Hi</div>'
		);
		const full: VisualMetrics = await measure(
			'<div style="position:absolute;left:0;top:0">Top left</div>'
			+ '<div style="position:absolute;right:0;bottom:0">Bottom right</div>'
		);

		assert.ok(sparse.contentWidthCoverage < 20, `sparse coverage should be low, got ${sparse.contentWidthCoverage}`);
		assert.ok(full.contentWidthCoverage >= 99, `full coverage should be ~100, got ${full.contentWidthCoverage}`);
		assert.ok(full.contentHeightCoverage >= 99, `full coverage should be ~100, got ${full.contentHeightCoverage}`);
	});

	void it('reports the root box so a mis-sized surface cannot pass unnoticed', async (): Promise<void> => {
		const metrics: VisualMetrics = await measure('<p style="margin:0">Anything.</p>');

		assert.equal(metrics.rootWidth, 600);
		assert.equal(metrics.rootHeight, 400);
	});

	void it('collects ink measurements for rendered text', async (): Promise<void> => {
		// `overflow:hidden` is what puts the element in scope: ink safety asks whether a clipping box
		// cuts a descender, so text that cannot be clipped is deliberately not measured.
		const metrics: VisualMetrics = await measure(
			'<p class="inked" style="margin:0;overflow:hidden;height:20px">Typography</p>'
		);

		assert.ok(
			metrics.textInkMeasurements.length > 0,
			'text ink safety cannot fail if nothing is ever measured'
		);
	});
});
