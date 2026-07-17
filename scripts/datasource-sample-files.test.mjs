import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { getBindingSampleFileName, readBindingSample, writeBindingSampleFiles } from './datasource-sample-files.mjs';

const bindings = [
	{
		property: 'calendarData',
		source: { sampleData: 'sample-datasource.json', samplePath: 'calendar' }
	},
	{
		property: 'feedData',
		source: { sampleData: 'sample-datasource.json', samplePath: 'feed.channel' }
	}
];

describe('datasource sample files', () => {
	it('extracts the exact value selected by samplePath', (context) => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-datasource-samples-'));
		context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
		fs.writeFileSync(
			path.join(directory, 'sample-datasource.json'),
			JSON.stringify({
				calendar: { events: [{ title: 'Studio tour' }] },
				feed: { channel: { items: [{ title: 'North entrance' }] } }
			})
		);

		assert.deepEqual(readBindingSample(directory, bindings[0]), {
			events: [{ title: 'Studio tour' }]
		});
		assert.deepEqual(readBindingSample(directory, bindings[1]), {
			items: [{ title: 'North entrance' }]
		});
	});

	it('writes one clearly named payload for every binding', (context) => {
		const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-datasource-samples-'));
		context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
		fs.writeFileSync(
			path.join(directory, 'sample-datasource.json'),
			JSON.stringify({
				calendar: { events: [] },
				feed: { channel: { items: [] } }
			})
		);

		const files = writeBindingSampleFiles({
			bindings,
			projectDirectory: directory,
			outputDirectory: directory,
			prefix: 'datasource-template'
		});

		assert.deepEqual(files, [
			{ bindingProperty: 'calendarData', fileName: 'datasource-template-calendarData.json' },
			{ bindingProperty: 'feedData', fileName: 'datasource-template-feedData.json' }
		]);
		assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, files[0].fileName), 'utf8')), {
			events: []
		});
		assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, files[1].fileName), 'utf8')), {
			items: []
		});
	});

	it('rejects unsafe binding properties', () => {
		assert.throws(() => getBindingSampleFileName('../calendar', 'sample-datasource'), /cannot be used/);
	});
});
