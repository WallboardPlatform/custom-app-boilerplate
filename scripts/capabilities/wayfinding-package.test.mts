import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { Ajv, type AnySchema, type ValidateFunction } from 'ajv';
import { strFromU8, unzipSync } from 'fflate';

const packagePath = path.resolve(
	'examples',
	'wayfinding-kiosk',
	'overlay',
	'src',
	'assets',
	'synthetic-campus.wbmap'
);

const packageEntries = (): Record<string, Uint8Array> => unzipSync(
	new Uint8Array(fs.readFileSync(packagePath))
);

function readEntry<T>(entries: Record<string, Uint8Array>, name: string): T {
	const bytes = entries[name];

	assert.ok(bytes, `The synthetic .wbmap must contain ${name}.`);

	return JSON.parse(strFromU8(bytes)) as T;
}

const graphValidator = (): ValidateFunction => {
	const schemaPath = path.resolve('schemas', 'wayfinding-route-graph.schema.json');
	const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as AnySchema;

	return new Ajv({ allErrors: true, strict: true }).compile(schema);
};

void describe('canonical Wayfinding example package', (): void => {
	void it('uses a compact Studio-published v2 package without Atlas', (): void => {
		const entries = packageEntries();
		const manifest = readEntry<{
			capabilities?: { routing?: boolean; stepFreeRouting?: boolean };
			formatVersion?: number;
		}>(entries, 'manifest.json');
		const map = readEntry<{
			buildings?: unknown[];
			connectors?: unknown[];
			levels?: Array<{ id?: string; scenePath?: string; svgPath?: string }>;
			presentation?: { enabledOverviewModes?: string[] };
			siteLevelId?: string;
			voiceGuidance?: Array<{ destinationId?: string; originId?: string; text?: Record<string, string> }>;
		}>(entries, 'map.json');

		assert.equal(fs.statSync(packagePath).size < 100_000, true, 'Keep the public fixture compact.');
		assert.equal(manifest.formatVersion, 2);
		assert.deepEqual(manifest.capabilities, { routing: true, stepFreeRouting: true });
		assert.equal(map.siteLevelId, 'site');
		assert.equal(map.buildings?.length, 3);
		assert.equal(map.connectors?.length, 7);
		assert.equal(map.levels?.length, 6);
		assert.deepEqual(map.presentation?.enabledOverviewModes, ['site', 'exploded-3d']);
		assert.equal(map.voiceGuidance?.length, 5);
		assert.equal(map.voiceGuidance?.every((entry): boolean => Boolean(
			entry.destinationId && entry.originId && entry.text?.en?.trim()
		)), true);

		for (const level of map.levels ?? []) {
			assert.match(level.scenePath ?? '', /^levels\/.+\.scene\.json$/u);
			assert.match(level.svgPath ?? '', /^levels\/.+\.svg$/u);
			assert.ok(entries[level.scenePath ?? ''], `Missing scene for ${level.id}.`);
			assert.ok(entries[level.svgPath ?? ''], `Missing SVG for ${level.id}.`);
		}
	});

	void it('ships a schema-valid route graph', (): void => {
		const graph = readEntry<unknown>(packageEntries(), 'routes/graph.json');
		const validate = graphValidator();

		assert.equal(validate(graph), true, JSON.stringify(validate.errors));
	});

	void it('keeps public authoring contracts separate from the viewer implementation', (): void => {
		for (const publicSource of [
			'src/utils/wayfinding-contract.ts',
			'src/utils/wayfinding.ts',
			'src/utils/wayfinding-presentation.ts',
			'src/utils/wayfinding-guidance.ts'
		]) {
			assert.equal(fs.existsSync(path.resolve(publicSource)), true, publicSource);
		}
		assert.equal(fs.existsSync(path.resolve('examples', 'wayfinding-kiosk', 'source')), false);
	});
});
