import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv, type AnySchema, type ErrorObject } from 'ajv';

import type { WayfindingGraphDocument } from '../../src/utils/wayfinding.js';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const schema = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'schemas', 'wayfinding-route-graph.schema.json'), 'utf8')) as AnySchema;
const ajv = new Ajv({ allErrors: true, strict: true });
const validateSchema = ajv.compile<WayfindingGraphDocument>(schema);

export const parseRouteGraph = (source: string): WayfindingGraphDocument => {
	const value: unknown = JSON.parse(source.replace(/^\uFEFF/, '')) as unknown;

	if (!validateSchema(value)) {
		const details: string = (validateSchema.errors ?? [])
			.map((error: ErrorObject): string => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
			.join('; ');

		throw new Error(`Route graph schema validation failed: ${details}`);
	}

	return value as WayfindingGraphDocument;
};
