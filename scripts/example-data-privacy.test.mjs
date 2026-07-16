import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validateSyntheticSample } from './example-data-privacy.mjs';

void describe('example data privacy', () => {
	void it('accepts explicitly synthetic reserved data', () => {
		assert.doesNotThrow(() => validateSyntheticSample(
			'example',
			{ sampleDataClassification: 'synthetic' },
			{ id: 'sample-1', email: 'person@example.invalid', credentialId: 'sample-only', url: 'https://asset.example.invalid/a.png' }
		));
	});

	void it('requires an explicit synthetic classification', () => {
		assert.throws(
			() => validateSyntheticSample('example', {}, { id: 'sample-1' }),
			/sampleDataClassification/
		);
	});

	void it('rejects production-shaped identifiers and environment URLs', () => {
		assert.throws(
			() => validateSyntheticSample(
				'example',
				{ sampleDataClassification: 'synthetic' },
				{ datasourceId: '511565bee3404651a320da0196f82b07' }
			),
			/production-shaped identifier/
		);
		assert.throws(
			() => validateSyntheticSample(
				'example',
				{ sampleDataClassification: 'synthetic' },
				{ url: 'https://development.wallboard.info/public-api/datasource/example/resource' }
			),
			/Wallboard environment URL/
		);
	});

	void it('rejects real-looking contact and credential values', () => {
		assert.throws(
			() => validateSyntheticSample(
				'example',
				{ sampleDataClassification: 'synthetic' },
				{ email: 'person@company.com' }
			),
			/non-reserved email/
		);
		assert.throws(
			() => validateSyntheticSample(
				'example',
				{ sampleDataClassification: 'synthetic' },
				{ accessToken: 'live-value' }
			),
			/non-sentinel value/
		);
	});
});

