import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import { Ajv, type AnySchema, type ValidateFunction } from 'ajv';
import { strFromU8, unzipSync } from 'fflate';

const readJson = (filePath: string): unknown => JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;

const compileSchema = (filePath: string, dependencyPaths: readonly string[] = []): ValidateFunction => {
	const ajv = new Ajv({ allErrors: true, strict: true });

	for (const dependencyPath of dependencyPaths) {
		ajv.addSchema(readJson(dependencyPath) as AnySchema);
	}

	return ajv.compile(readJson(filePath) as AnySchema);
};

const validate = (validator: ValidateFunction, value: unknown, label: string): void => {
	assert.equal(
		validator(value),
		true,
		`${label}: ${JSON.stringify(validator.errors)}`
	);
};

void describe('public Wayfinding interoperability contract', (): void => {
	const projectSchemaPath = path.resolve('schemas', 'wayfinding-studio-project.schema.json');
	const graphSchemaPath = path.resolve('schemas', 'wayfinding-route-graph.schema.json');

	void it('keeps the public schemas valid against both editable reference projects', (): void => {
		const validateProject = compileSchema(projectSchemaPath, [graphSchemaPath]);
		const validateGraph = compileSchema(graphSchemaPath);

		for (const projectPath of [
			path.resolve('examples', 'spatial-wayfinding', 'source', 'campus.wbwayfinding'),
			path.resolve('examples', 'veszprem-wayfinding', 'veszprem-downtown.wbwayfinding')
		]) {
			const project = readJson(projectPath) as { graph?: unknown };

			validate(validateProject, project, projectPath);
			validate(validateGraph, project.graph, `${projectPath} graph`);
		}
	});

	void it('validates the graph shipped inside the public .wbmap reference package', (): void => {
		const packagePath = path.resolve(
			'examples',
			'spatial-wayfinding',
			'overlay',
			'src',
			'assets',
			'campus.wbmap'
		);
		const entries = unzipSync(new Uint8Array(fs.readFileSync(packagePath)));
		const graphBytes: Uint8Array | undefined = entries['routes/graph.json'];

		assert.ok(graphBytes, 'The public .wbmap reference must contain routes/graph.json.');
		validate(
			compileSchema(graphSchemaPath),
			JSON.parse(strFromU8(graphBytes)) as unknown,
			`${packagePath} routes/graph.json`
		);
	});

	void it('publishes the custom You are here marker as a complete public consumer contract', (): void => {
		const projectPath = path.resolve('examples', 'spatial-wayfinding', 'source', 'campus.wbwayfinding');
		const project = readJson(projectPath) as {
			assets?: Array<{ id?: string; kind?: string }>;
			defaults?: { origin?: { markerAssetId?: string; markerSize2d?: number; markerSize3d?: number } };
		};
		const projectOrigin = project.defaults?.origin;
		const markerAssetId: string | undefined = projectOrigin?.markerAssetId;

		assert.equal(projectOrigin?.markerSize2d, 64);
		assert.equal(projectOrigin?.markerSize3d, 84);
		assert.ok(markerAssetId);
		assert.equal(
			project.assets?.some((asset): boolean => asset.id === markerAssetId && asset.kind === 'marker'),
			true
		);

		const packagePath = path.resolve(
			'examples',
			'spatial-wayfinding',
			'overlay',
			'src',
			'assets',
			'campus.wbmap'
		);
		const entries = unzipSync(new Uint8Array(fs.readFileSync(packagePath)));
		const mapBytes: Uint8Array | undefined = entries['map.json'];

		assert.ok(mapBytes, 'The public .wbmap reference must contain map.json.');
		const map = JSON.parse(strFromU8(mapBytes)) as {
			assets?: Array<{ id?: string; kind?: string }>;
			defaults?: { origin?: { markerAssetId?: string; markerSize2d?: number; markerSize3d?: number } };
		};
		assert.deepEqual(map.defaults?.origin, projectOrigin);
		assert.equal(
			map.assets?.some((asset): boolean => asset.id === markerAssetId && asset.kind === 'symbol'),
			true
		);
	});

	void it('keeps every documented public consumer source available', (): void => {
		for (const publicSource of [
			'src/utils/wayfinding.ts',
			'src/utils/wayfinding-presentation.ts',
			'src/utils/wayfinding-guidance.ts',
			'examples/spatial-wayfinding/overlay/src/interfaces/spatial-wayfinding.interface.ts',
			'examples/spatial-wayfinding/overlay/src/utils/wayfinding-map-package.ts'
		]) {
			assert.equal(fs.existsSync(path.resolve(publicSource)), true, publicSource);
		}
	});
});
