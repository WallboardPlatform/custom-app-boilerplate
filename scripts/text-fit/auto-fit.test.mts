import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fitTextElement, findLargestFittingFontSize } from '../../src/utils/text-fit.ts';

interface StubBox {
	clientWidth: number;
	clientHeight: number;
	/** Rendered text extent at 1px font size; scales with the candidate size. */
	contentWidthPerPx: number;
	contentHeightPerPx?: number;
}

/**
 * Stands in for a laid-out element. `scrollWidth`/`scrollHeight` are clamped to the client box
 * exactly as the browser clamps them, which is the behaviour the fitting logic has to survive.
 */
const stubElement = (box: StubBox): HTMLElement => {
	const style: Record<string, string> = {};
	const fontSize = (): number => Number.parseFloat(style.fontSize ?? '0') || 0;

	return {
		style,
		clientWidth: box.clientWidth,
		clientHeight: box.clientHeight,
		get scrollWidth(): number {
			return Math.max(box.clientWidth, Math.round(fontSize() * box.contentWidthPerPx));
		},
		get scrollHeight(): number {
			return Math.max(box.clientHeight, Math.round(fontSize() * (box.contentHeightPerPx ?? 0)));
		}
	} as unknown as HTMLElement;
};

void describe('auto-fit text sizing', (): void => {
	void it('finds the largest font size accepted by the measured box', (): void => {
		const result: number = findLargestFittingFontSize({
			minimum: 12,
			maximum: 72,
			fits: (fontSize: number): boolean => fontSize <= 43
		});

		assert.equal(result, 43);
	});

	void it('returns the minimum when no larger size fits', (): void => {
		const result: number = findLargestFittingFontSize({
			minimum: 14,
			maximum: 48,
			fits: (fontSize: number): boolean => fontSize <= 14
		});

		assert.equal(result, 14);
	});

	void it('normalizes reversed and fractional bounds', (): void => {
		const result: number = findLargestFittingFontSize({
			minimum: 20.4,
			maximum: 8,
			fits: (): boolean => true
		});

		assert.equal(result, 20);
	});
});

void describe('fitting a laid-out element', (): void => {
	void it('does not collapse an element that fills its container to the floor', (): void => {
		// A `display: block` span in a grid cell: its box is the container, so scrollWidth
		// never drops below clientWidth however small the text gets.
		const element: HTMLElement = stubElement({ clientWidth: 300, clientHeight: 40, contentWidthPerPx: 0 });

		assert.equal(fitTextElement(element, { minFontSize: 8, maxFontSize: 48 }), 48);
	});

	void it('still constrains a filling element once its text actually overflows', (): void => {
		// 12 units of text width per px of font size: overflows 300px above 25px.
		const element: HTMLElement = stubElement({ clientWidth: 300, clientHeight: 400, contentWidthPerPx: 12 });

		assert.equal(fitTextElement(element, { minFontSize: 8, maxFontSize: 48, widthOnly: true }), 25);
	});

	void it('constrains on height when width is unbounded', (): void => {
		// Wrapping text in a fixed-height box: height overflows above 20px.
		const element: HTMLElement = stubElement({
			clientWidth: 300,
			clientHeight: 200,
			contentWidthPerPx: 0,
			contentHeightPerPx: 10
		});

		assert.equal(fitTextElement(element, { minFontSize: 8, maxFontSize: 48 }), 20);
	});

	void it('returns the floor when the element has not been laid out', (): void => {
		const element: HTMLElement = stubElement({ clientWidth: 0, clientHeight: 0, contentWidthPerPx: 1 });

		assert.equal(fitTextElement(element, { minFontSize: 11, maxFontSize: 48 }), 11);
	});
});
