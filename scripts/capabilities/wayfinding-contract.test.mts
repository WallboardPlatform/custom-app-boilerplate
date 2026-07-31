import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

import { Ajv, type AnySchema, type ValidateFunction } from 'ajv';
import { strFromU8, unzipSync } from 'fflate';

const readJson = (filePath: string): unknown => JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;

const loadPublicPackageLoader = async (): Promise<(archive: Uint8Array) => {
	buildings: unknown[];
	connectors: unknown[];
	formatVersion: number;
	levels: Array<{ role?: string }>;
	presentation: { enabledOverviewModes: string[] };
	siteLevelId?: string;
}> => {
	const loaderUrl = pathToFileURL(path.resolve(
		'examples',
		'spatial-wayfinding',
		'overlay',
		'src',
		'utils',
		'wayfinding-map-package.ts'
	)).href;
	const module = await import(loaderUrl) as {
		loadWayfindingMapPackage: (archive: Uint8Array) => {
			buildings: unknown[];
			connectors: unknown[];
			formatVersion: number;
			levels: Array<{ role?: string }>;
			presentation: { enabledOverviewModes: string[] };
			siteLevelId?: string;
		};
	};

	return module.loadWayfindingMapPackage;
};

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

	void it('keeps the public schemas valid against every editable reference project', (): void => {
		const validateProject = compileSchema(projectSchemaPath, [graphSchemaPath]);
		const validateGraph = compileSchema(graphSchemaPath);

		for (const projectPath of [
			path.resolve('examples', 'spatial-wayfinding', 'source', 'campus.wbwayfinding'),
			path.resolve('examples', 'spatial-wayfinding', 'source', 'multi-building-campus.wbwayfinding'),
			path.resolve('examples', 'veszprem-wayfinding', 'veszprem-downtown.wbwayfinding')
		]) {
			const project = readJson(projectPath) as { graph?: unknown };

			validate(validateProject, project, projectPath);
			validate(validateGraph, project.graph, `${projectPath} graph`);
		}
	});

	void it('normalizes v1 and v2 published packages to one v2 runtime contract', async (): Promise<void> => {
		const loadWayfindingMapPackage = await loadPublicPackageLoader();
		const assetDirectory = path.resolve('examples', 'spatial-wayfinding', 'overlay', 'src', 'assets');
		const legacyPackage = loadWayfindingMapPackage(new Uint8Array(fs.readFileSync(path.join(assetDirectory, 'campus.wbmap'))));
		const campusPackage = loadWayfindingMapPackage(new Uint8Array(fs.readFileSync(path.join(assetDirectory, 'multi-building-campus.wbmap'))));

		assert.equal(legacyPackage.formatVersion, 2);
		assert.equal(legacyPackage.levels.length, 1);
		assert.equal(legacyPackage.levels[0]?.role, 'standalone');
		assert.deepEqual(legacyPackage.buildings, []);
		assert.deepEqual(legacyPackage.connectors, []);

		assert.equal(campusPackage.formatVersion, 2);
		assert.equal(campusPackage.siteLevelId, 'site');
		assert.equal(campusPackage.levels.length, 6);
		assert.equal(campusPackage.buildings.length, 3);
		assert.equal(campusPackage.connectors.length, 7);
		assert.equal(campusPackage.levels.filter((level) => level.role === 'building-floor').length, 5);
		assert.equal(campusPackage.presentation.enabledOverviewModes.includes('atlas-2d'), true);
		assert.equal(campusPackage.presentation.enabledOverviewModes.includes('exploded-3d'), true);
	});

	void it('publishes the v2 package with level scenes and complete venue metadata', (): void => {
		const packagePath = path.resolve(
			'examples',
			'spatial-wayfinding',
			'overlay',
			'src',
			'assets',
			'multi-building-campus.wbmap'
		);
		const entries = unzipSync(new Uint8Array(fs.readFileSync(packagePath)));
		const manifest = JSON.parse(strFromU8(entries['manifest.json'])) as {
			capabilities?: { routing?: boolean; stepFreeRouting?: boolean };
			formatVersion?: number;
		};
		const map = JSON.parse(strFromU8(entries['map.json'])) as {
			buildings?: unknown[];
			connectors?: unknown[];
			levels?: Array<{ id?: string; scenePath?: string; svgPath?: string }>;
			presentation?: { enabledOverviewModes?: string[] };
			siteLevelId?: string;
		};

		assert.equal(manifest.formatVersion, 2);
		assert.deepEqual(manifest.capabilities, { routing: true, stepFreeRouting: true });
		assert.equal(map.siteLevelId, 'site');
		assert.equal(map.buildings?.length, 3);
		assert.equal(map.connectors?.length, 7);
		assert.equal(map.levels?.length, 6);
		assert.deepEqual(map.presentation?.enabledOverviewModes, ['site', 'atlas-2d', 'exploded-3d']);

		for (const level of map.levels ?? []) {
			assert.match(level.scenePath ?? '', /^levels\/.+\.scene\.json$/);
			assert.match(level.svgPath ?? '', /^levels\/.+\.svg$/);
			assert.ok(entries[level.scenePath ?? ''], `Missing scene for ${level.id}.`);
			assert.ok(entries[level.svgPath ?? ''], `Missing SVG for ${level.id}.`);
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
			'src/utils/wayfinding-contract.ts',
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
