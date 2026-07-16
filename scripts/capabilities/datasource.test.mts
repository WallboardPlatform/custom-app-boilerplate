import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { extractArrayAtPaths, isRecord, parseSerializedValue } from '../../src/utils/datasource.js';

void describe('datasource normalization capability', (): void => {
	void it('reads direct and serialized arrays', (): void => {
		assert.deepEqual(extractArrayAtPaths([{ id: 1 }], []), [{ id: 1 }]);
		assert.deepEqual(extractArrayAtPaths('[{"id":2}]', []), [{ id: 2 }]);
	});

	void it('reads only explicitly declared wrapper paths', (): void => {
		const value: unknown = { value: JSON.stringify({ data: { rows: [{ id: 3 }] } }), ignored: [4] };

		assert.deepEqual(extractArrayAtPaths(value, [['value', 'data', 'rows']]), [{ id: 3 }]);
		assert.equal(extractArrayAtPaths(value, [['missing'], ['value', 'items']]), undefined);
	});

	void it('preserves malformed strings for app-specific fallback handling', (): void => {
		assert.equal(parseSerializedValue('not-json'), 'not-json');
		assert.equal(isRecord(null), false);
		assert.equal(isRecord([]), false);
	});
});
