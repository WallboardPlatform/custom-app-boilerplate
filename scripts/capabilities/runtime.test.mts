import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createInternalDatasourceWriter } from '../../src/utils/internal-datasource.js';
import { resolveMediaFit } from '../../src/utils/media.js';
import { resolveMotion } from '../../src/utils/motion.js';

void describe('interactive runtime capabilities', (): void => {
	void it('blocks datasource writes outside the displayer', (): void => {
		let writes = 0;
		const writer = createInternalDatasourceWriter(
			{ isDisplayer: (): boolean => false },
			{
				insertToArray: (): void => { writes += 1; },
				merge: (): void => { writes += 1; },
				set: (): void => { writes += 1; }
			}
		);

		assert.deepEqual(writer.append('results', 'rows', {}), { status: 'editor-blocked' });
		assert.equal(writes, 0);
	});

	void it('reports synchronous datasource failures', (): void => {
		const writer = createInternalDatasourceWriter(
			{ isDisplayer: (): boolean => true },
			{
				insertToArray: (): string => 'Binding not found',
				merge: (): void => undefined,
				set: (): void => undefined
			}
		);

		assert.deepEqual(writer.append('missing', 'rows', {}), { status: 'failed', message: 'Binding not found' });
	});

	void it('resolves coordinated motion and media policies', (): void => {
		assert.equal(resolveMotion('expressive').enabled, true);
		assert.equal(resolveMotion('expressive', true).enabled, false);
		assert.deepEqual(resolveMediaFit('blur-fill'), {
			foregroundFit: 'contain',
			showBlurBackground: true
		});
	});
});
