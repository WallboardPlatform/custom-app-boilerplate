import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv, type AnySchema, type ErrorObject } from 'ajv';

import type { WayfindingGraphDocument } from '../../src/utils/wayfinding.js';
import type { WayfindingStudioProject } from './studio-project.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const routeGraphSchema = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'schemas', 'wayfinding-route-graph.schema.json'), 'utf8')) as AnySchema;
const studioProjectSchema = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'schemas', 'wayfinding-studio-project.schema.json'), 'utf8')) as AnySchema;
const ajv = new Ajv({ allErrors: true, strict: true });
ajv.addSchema(routeGraphSchema);
const validateRouteGraphSchema = ajv.compile<WayfindingGraphDocument>(routeGraphSchema);
const validateStudioProjectSchema = ajv.compile<WayfindingStudioProject>(studioProjectSchema);

const formatErrors = (errors: ErrorObject[] | null | undefined): string => (errors ?? [])
	.map((error: ErrorObject): string => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
	.join('; ');

export const parseRouteGraph = (source: string): WayfindingGraphDocument => {
	const value: unknown = JSON.parse(source.replace(/^\uFEFF/, '')) as unknown;

	if (!validateRouteGraphSchema(value)) {
		throw new Error(`Route graph schema validation failed: ${formatErrors(validateRouteGraphSchema.errors)}`);
	}

	return value as WayfindingGraphDocument;
};

export const parseWayfindingStudioProjectSource = (source: string): WayfindingStudioProject => {
	const value: unknown = JSON.parse(source.replace(/^\uFEFF/, '')) as unknown;

	if (!validateStudioProjectSchema(value)) {
		throw new Error(`Wayfinding Studio project schema validation failed: ${formatErrors(validateStudioProjectSchema.errors)}`);
	}

	return value as WayfindingStudioProject;
};
