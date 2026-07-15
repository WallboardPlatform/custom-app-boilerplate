import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findTextInkRisks, formatTextInkRisks, type TextInkMeasurement } from '../../preview/text-ink-safety.ts';

const clippedHeading = (overrides: Partial<TextInkMeasurement> = {}): TextInkMeasurement => ({
	selector: 'h1.title',
	text: 'Unit group pulse',
	overflowY: 'hidden',
	fontSize: 38,
	lineHeight: 38,
	boxHeight: 38,
	borderTop: 0,
	borderBottom: 0,
	paddingBottom: 0,
	lineCount: 1,
	actualAscent: 29,
	actualDescent: 9,
	...overrides
});

void describe('text ink safety', () => {
	void it('rejects clipped headings whose glyph ink consumes the complete line box', () => {
		const risks = findTextInkRisks([clippedHeading()]);

		assert.equal(risks.length, 1);
		assert.equal(risks[0]?.buffer, 0);
		assert.match(formatTextInkRisks(risks), /Unit group pulse.*at least 1.33px and 3.04px/);
	});

	void it('accepts a clipped heading with enough vertical ink buffer', () => {
		assert.deepEqual(findTextInkRisks([clippedHeading({ boxHeight: 45, paddingBottom: 4 })]), []);
	});

	void it('rejects descender text when total space exists above the baseline but not below it', () => {
		const risks = findTextInkRisks([clippedHeading({ boxHeight: 42, actualAscent: 27, actualDescent: 7 })]);

		assert.equal(risks.length, 1);
		assert.equal(risks[0]?.descenderClearance, 0);
	});

	void it('ignores text that is not vertically clipped', () => {
		assert.deepEqual(findTextInkRisks([clippedHeading({ overflowY: 'visible' })]), []);
	});

	void it('accounts for every rendered line in wrapped text', () => {
		const risks = findTextInkRisks([clippedHeading({ lineCount: 2, boxHeight: 76 })]);

		assert.equal(risks.length, 1);
		assert.equal(risks[0]?.inkHeight, 76);
	});

	void it('ignores intentionally truncated lines outside the visible clip box', () => {
		const risks = findTextInkRisks([
			clippedHeading({
				text: 'A deliberately long title rendered across three lines',
				fontSize: 50,
				lineHeight: 54.5,
				boxHeight: 109,
				lineCount: 3,
				actualAscent: 38,
				actualDescent: 12,
				paddingBottom: 5
			})
		]);

		assert.deepEqual(risks, []);
	});

	void it('rejects text clipped by an ancestor even when its own box is tall enough', () => {
		const risks = findTextInkRisks([
			clippedHeading({
				lineHeight: 44,
				boxHeight: 50,
				visibleHeight: 39,
				actualAscent: 30,
				actualDescent: 8
			})
		]);

		assert.equal(risks.length, 1);
	});
});
