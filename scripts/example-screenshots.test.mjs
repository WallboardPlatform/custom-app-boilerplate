import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { selectReferenceScreenshots } from './example-screenshots.mjs';

void describe('reference screenshot selection', () => {
	void it('returns the explicit one-or-two image allowlist', () => {
		assert.deepEqual(
			selectReferenceScreenshots(
				{ referenceScreenshots: ['default.png', 'portrait.png'] },
				['default.png', 'empty.png', 'portrait.png']
			),
			['default.png', 'portrait.png']
		);
	});

	void it('rejects missing, oversized, duplicate, and unknown selections', () => {
		assert.throws(() => selectReferenceScreenshots({}, ['default.png']), /one or two/);
		assert.throws(
			() => selectReferenceScreenshots(
				{ referenceScreenshots: ['a.png', 'b.png', 'c.png'] },
				['a.png', 'b.png', 'c.png']
			),
			/one or two/
		);
		assert.throws(
			() => selectReferenceScreenshots(
				{ referenceScreenshots: ['a.png', 'a.png'] },
				['a.png']
			),
			/unique/
		);
		assert.throws(
			() => selectReferenceScreenshots(
				{ referenceScreenshots: ['missing.png'] },
				['default.png']
			),
			/not found/
		);
	});
});
