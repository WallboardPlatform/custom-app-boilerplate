import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeCircularIndex, pageAt, paginate } from '../../src/utils/pagination.js';

void describe('pagination capability', (): void => {
	void it('uses full pages by default', (): void => {
		assert.deepEqual(paginate([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
	});

	void it('balances a sparse final page when requested', (): void => {
		assert.deepEqual(paginate([1, 2, 3, 4, 5, 6, 7, 8, 9], 8, { balancePages: true }), [
			[1, 2, 3, 4, 5],
			[6, 7, 8, 9]
		]);
	});

	void it('normalizes circular indexes without failing on empty pages', (): void => {
		assert.equal(normalizeCircularIndex(-1, 3), 2);
		assert.deepEqual(pageAt([['a'], ['b']], 3), ['b']);
		assert.deepEqual(pageAt([], 4), []);
	});
});
