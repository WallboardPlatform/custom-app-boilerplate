import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getDatasourceProvisioning } from './datasource-provisioning.mjs';

describe('datasource provisioning', () => {
	it('creates generated TABLE and CUSTOM sources', () => {
		for (const contract of ['TABLE', 'CUSTOM']) {
			assert.deepEqual(getDatasourceProvisioning(contract), {
				current: 'create-or-import-then-bind',
				future: 'create-from-packaged-template'
			});
		}
	});

	it('selects supplied EXISTING sources', () => {
		assert.deepEqual(getDatasourceProvisioning('EXISTING'), {
			current: 'select-existing-then-bind',
			future: 'bind-existing-source'
		});
	});

	it('selects integrated FEED and CALENDAR sources', () => {
		for (const contract of ['FEED', 'CALENDAR']) {
			assert.deepEqual(getDatasourceProvisioning(contract), {
				current: 'select-integrated-then-bind',
				future: 'bind-integrated-source'
			});
		}
	});

	it('rejects unknown contracts', () => {
		assert.throws(() => getDatasourceProvisioning('UNKNOWN'), /Unsupported datasource contract/);
	});
});
