import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { strFromU8, unzipSync } from 'fflate';

import {
	createWayfindingMapPackage,
	parseWayfindingMapPackage,
	wayfindingMapPackageToRuntimeBundle,
	type WayfindingPublishedDestination
} from './runtime-package.mts';
import {
	createWayfindingStudioProject,
	parseWayfindingStudioProject,
	type WayfindingStudioProject
} from './studio-project.mts';

const confirmed = { provenance: 'reviewer-authored' as const, status: 'confirmed' as const };
const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAA';

const publishableProject = (): WayfindingStudioProject => {
	const project = createWayfindingStudioProject('visitor-center');
	project.name = 'Visitor Center';
	project.delivery.guidance.targetMode = 'directory';
	project.assets = [
		{ dataUrl: pngDataUrl, id: 'floor-plan', kind: 'background', mimeType: 'image/png', name: 'Floor plan.png', naturalHeight: 720, naturalWidth: 1280 },
		{ dataUrl: pngDataUrl, id: 'info-symbol', kind: 'icon', mimeType: 'image/png', name: 'Information.png', naturalHeight: 64, naturalWidth: 64 },
		{ dataUrl: pngDataUrl, id: 'tenant-brand', kind: 'logo', mimeType: 'image/png', name: 'Tenant brand.png', naturalHeight: 80, naturalWidth: 240 },
		{ dataUrl: pngDataUrl, id: 'lobby-photo', kind: 'photo', mimeType: 'image/png', name: 'Lobby photo.png', naturalHeight: 900, naturalWidth: 1200 }
	];
	project.destinations = [{
		category: 'Services',
		description: 'Maps, tickets, and visitor assistance.',
		floor: 'level-0',
		id: 'information',
		name: 'Visitor information',
		photoAssetIds: ['lobby-photo'],
		routeable: false
	}];
	project.floors[0].backgroundAssetId = 'floor-plan';
	project.floors[0].camera3d = {
		azimuthDegrees: 18,
		distance: 1450,
		pitchDegrees: 52,
		targetX: 640,
		targetY: 360
	};
	project.floors[0].elements = [
		{
			...confirmed,
			destinationId: 'information',
			floorId: 'level-0',
			geometry: [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 260 }, { x: 100, y: 260 }],
			id: 'information-room',
			type: 'location'
		},
		{
			...confirmed,
			angle: 0,
			floorId: 'level-0',
			id: 'information-door',
			length: 32,
			locationId: 'information-room',
			point: { x: 200, y: 260 },
			type: 'door'
		},
		{
			...confirmed,
			assetId: 'info-symbol',
			destinationId: 'information',
			floorId: 'level-0',
			height: 64,
			id: 'information-symbol',
			point: { x: 160, y: 140 },
			type: 'icon',
			width: 64
		},
		{
			...confirmed,
			assetId: 'tenant-brand',
			destinationId: 'information',
			floorId: 'level-0',
			height: 40,
			id: 'information-brand',
			point: { x: 120, y: 210 },
			type: 'logo',
			width: 120
		}
	];

	return project;
};

void test('publishes the documented .wbmap file structure without embedding data URLs in JSON', () => {
	const archive = createWayfindingMapPackage(publishableProject());
	const entries = unzipSync(archive);
	const paths = Object.keys(entries).sort();

	assert.deepEqual(paths, [
		'assets/floor-plan.png',
		'assets/info-symbol.png',
		'assets/lobby-photo.png',
		'assets/tenant-brand.png',
		'data/destinations.json',
		'floors/level-0.scene.json',
		'floors/level-0.svg',
		'manifest.json',
		'map.json',
		'routes/graph.json'
	]);
	assert.doesNotMatch(strFromU8(entries['map.json']), /data:image\//u);
	assert.match(strFromU8(entries['floors/level-0.svg']), /href="\.\.\/assets\/floor-plan\.png"/u);
	assert.match(strFromU8(entries['floors/level-0.svg']), /data-wayfinding-location-id="information"/u);
});

void test('round-trips published destination geometry, entrances, symbols, brands, and binary assets', () => {
	const archive = createWayfindingMapPackage(publishableProject());
	const published = parseWayfindingMapPackage(archive);
	const destination = published.destinations[0];

	assert.equal(published.manifest.format, 'wallboard-wayfinding-map');
	assert.equal(published.manifest.projectName, 'Visitor Center');
	assert.deepEqual(published.floors[0].camera3d, {
		azimuthDegrees: 18,
		distance: 1450,
		pitchDegrees: 52,
		targetX: 640,
		targetY: 360
	});
	assert.deepEqual(destination.geometryRefs, [{
		elementId: 'information-room',
		floorId: 'level-0',
		representation: 'area'
	}]);
	assert.deepEqual(destination.entranceRefs, [{ elementId: 'information-door', floorId: 'level-0' }]);
	assert.deepEqual(destination.symbolAssetIds, ['info-symbol']);
	assert.deepEqual(destination.brandAssetIds, ['tenant-brand']);
	assert.deepEqual(destination.photoAssetIds, ['lobby-photo']);
	assert.ok((published.assets.find((asset): boolean => asset.id === 'floor-plan')?.bytes.length ?? 0) > 0);
});

void test('adapts a .wbmap package to the existing runtime contract without losing asset data', () => {
	const runtime = wayfindingMapPackageToRuntimeBundle(createWayfindingMapPackage(publishableProject()));
	const destination = runtime.destinations.Destinations.rows[0] as unknown as WayfindingPublishedDestination;

	assert.equal(runtime.floors[0].backgroundAssetId, 'floor-plan');
	assert.equal(runtime.floors[0].camera3d?.pitchDegrees, 52);
	assert.match(runtime.floors[0].svg, /href="data:image\/png;base64,/u);
	assert.match(runtime.assets[0].dataUrl, /^data:image\/png;base64,/u);
	assert.equal(destination.geometryRefs[0]?.representation, 'area');
	assert.equal(destination.brandAssetIds[0], 'tenant-brand');
});

void test('keeps the checked spatial example package synchronized with its editable Studio source', () => {
	const sourcePath = path.resolve('examples', 'spatial-wayfinding', 'source', 'campus.wbwayfinding');
	const packagePath = path.resolve('examples', 'spatial-wayfinding', 'overlay', 'src', 'assets', 'campus.wbmap');
	const project = parseWayfindingStudioProject(JSON.parse(fs.readFileSync(sourcePath, 'utf8')));
	const generated = parseWayfindingMapPackage(createWayfindingMapPackage(project));
	const checked = parseWayfindingMapPackage(fs.readFileSync(packagePath));

	assert.deepEqual(checked, generated);
});
