import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findLargestFittingFontSize } from '../../src/utils/text-fit.ts';

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
