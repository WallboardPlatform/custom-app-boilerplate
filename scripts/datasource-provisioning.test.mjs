import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
	getDatasourceProvisioning,
	isDatasourceSourceCompatible,
	normalizeDatasourceBindings
} from './datasource-provisioning.mjs';

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

	it('owns source compatibility for every supported contract', () => {
		assert.equal(isDatasourceSourceCompatible('generated', 'TABLE'), true);
		assert.equal(isDatasourceSourceCompatible('generated', 'CUSTOM'), true);
		assert.equal(isDatasourceSourceCompatible('existing', 'EXISTING'), true);
		assert.equal(isDatasourceSourceCompatible('built-in', 'FEED'), true);
		assert.equal(isDatasourceSourceCompatible('built-in', 'CALENDAR'), true);
		assert.equal(isDatasourceSourceCompatible('existing', 'TABLE'), false);
	});

	it('normalizes legacy single-binding contracts', () => {
		assert.deepEqual(normalizeDatasourceBindings({
			binding: { property: 'items', dataPickerType: 'any' },
			source: { contract: 'TABLE' },
			delivery: { quickEditEligible: true },
			columns: []
		}), [{
			property: 'items',
			dataPickerType: 'any',
			source: { contract: 'TABLE' },
			delivery: { quickEditEligible: true },
			columns: []
		}]);
	});
});
