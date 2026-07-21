import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Ajv, type AnySchema, type ErrorObject } from 'ajv';

import type { WayfindingGraphDocument, WayfindingWalkableMaskDocument } from '../../src/utils/wayfinding.js';
import type { WayfindingProjectDocument } from './project.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const routeGraphSchema = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'schemas', 'wayfinding-route-graph.schema.json'), 'utf8')) as AnySchema;
const walkableMaskSchema = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'schemas', 'wayfinding-walkable-mask.schema.json'), 'utf8')) as AnySchema;
const projectSchema = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'schemas', 'wayfinding-project.schema.json'), 'utf8')) as AnySchema;
const ajv = new Ajv({ allErrors: true, strict: true });
const validateRouteGraphSchema = ajv.compile<WayfindingGraphDocument>(routeGraphSchema);
const validateWalkableMaskSchema = ajv.compile<WayfindingWalkableMaskDocument>(walkableMaskSchema);
const validateProjectSchema = ajv.compile<WayfindingProjectDocument>(projectSchema);

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

export const parseWalkableMask = (source: string): WayfindingWalkableMaskDocument => {
	const value: unknown = JSON.parse(source.replace(/^\uFEFF/, '')) as unknown;

	if (!validateWalkableMaskSchema(value)) {
		throw new Error(`Walkable mask schema validation failed: ${formatErrors(validateWalkableMaskSchema.errors)}`);
	}

	return value as WayfindingWalkableMaskDocument;
};

export const parseWayfindingProject = (source: string): WayfindingProjectDocument => {
	const value: unknown = JSON.parse(source.replace(/^\uFEFF/, '')) as unknown;

	if (!validateProjectSchema(value)) {
		throw new Error(`Wayfinding project schema validation failed: ${formatErrors(validateProjectSchema.errors)}`);
	}

	return value as WayfindingProjectDocument;
};
