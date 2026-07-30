import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createWayfindingStudioProject,
	type WayfindingStudioProject
} from '../../studio-project.mts';
import {
	buildVisitorMapItems,
	layoutVisitorMapLabels,
	visitorMapDetail,
	visitorMarkerIds
} from './visitor-map.ts';

const project: WayfindingStudioProject = createWayfindingStudioProject('test');
project.name = 'Test';
project.categories = ['Services'];
project.languages = [{ code: 'en', label: 'English' }, { code: 'hu', label: 'Hungarian' }];
project.destinations = [
		{
			category: 'Services',
			floor: 'level-0',
			id: 'destination-a',
			name: 'Visitor services',
			translations: { hu: { name: 'Ugyfelszolgalat' } }
		}
	];
project.floors = [{
		elements: [{
			destinationId: 'destination-a',
			floorId: 'level-0',
			geometry: [
				{ x: 10, y: 10 },
				{ x: 110, y: 10 },
				{ x: 110, y: 90 },
				{ x: 10, y: 90 }
			],
			id: 'location-a',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		}],
		height: 200,
		id: 'level-0',
		name: 'Ground floor',
		order: 0,
		width: 300
	}];

void test('visitor map items use translated names and the authored location centroid', (): void => {
	const [item] = buildVisitorMapItems(project, 'level-0', 'hu', project.destinations);

	assert.equal(item.name, 'Ugyfelszolgalat');
	assert.deepEqual(item.anchor, { x: 60, y: 50 });
	assert.equal(item.geometry?.length, 4);
});

void test('visitor map items prefer a destination-owned symbol over generic markers', (): void => {
	const symbolProject = structuredClone(project);
	symbolProject.assets.push({
		dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
		id: 'symbol-information',
		kind: 'icon',
		mimeType: 'image/svg+xml',
		name: 'Information'
	});
	symbolProject.destinations[0].symbolAssetId = 'symbol-information';
	const [item] = buildVisitorMapItems(
		symbolProject,
		'level-0',
		'en',
		symbolProject.destinations
	);

	assert.equal(item.symbolDataUrl, 'data:image/svg+xml;base64,PHN2Zy8+');
	assert.equal(visitorMarkerIds([item], 1).has('destination-a'), true);
});

void test('semantic zoom exposes compact, standard, and detailed tiers', (): void => {
	assert.equal(visitorMapDetail(0.4), 'compact');
	assert.equal(visitorMapDetail(1), 'standard');
	assert.equal(visitorMapDetail(1.8), 'detailed');
});

void test('the selected destination keeps a label at compact zoom', (): void => {
	const items = buildVisitorMapItems(project, 'level-0', 'en', project.destinations);

	assert.equal(layoutVisitorMapLabels(items, 0.4).length, 0);
	assert.equal(layoutVisitorMapLabels(items, 0.4, 'destination-a').length, 1);
});

void test('marker density follows semantic zoom and always preserves the selection', (): void => {
	const items = Array.from({ length: 30 }, (_, index) => ({
		anchor: { x: index * 10, y: 20 },
		description: '',
		destinationId: `destination-${index}`,
		logoDataUrl: index < 2 ? `data:image/png;base64,${index}` : undefined,
		name: `Destination ${index}`,
		presentation: 'ready' as const
	}));

	assert.deepEqual([...visitorMarkerIds(items, 0.4)], []);
	assert.equal(visitorMarkerIds(items, 1).size, 10);
	assert.equal(visitorMarkerIds(items, 1.8).size, 24);
	assert.ok(visitorMarkerIds(items, 0.4, 'destination-29').has('destination-29'));
	assert.ok(visitorMarkerIds(items, 1).has('destination-0'));
});

void test('compact zoom preserves authored symbols without introducing generic marker clutter', (): void => {
	const items = Array.from({ length: 12 }, (_, index) => ({
		anchor: { x: index * 10, y: 20 },
		description: '',
		destinationId: `destination-${index}`,
		name: `Destination ${index}`,
		presentation: 'ready' as const,
		symbolDataUrl: index < 3 ? `data:image/svg+xml;base64,${index}` : undefined
	}));
	const visible = visitorMarkerIds(items, 0.4);

	assert.deepEqual([...visible], ['destination-0', 'destination-1', 'destination-2']);
});

void test('label placement stays inside the map and limits standard-density clutter', (): void => {
	const items = Array.from({ length: 20 }, (_, index) => ({
		anchor: { x: 20 + (index % 5) * 52, y: 20 + Math.floor(index / 5) * 42 },
		description: '',
		destinationId: `destination-${index}`,
		name: `Destination ${index}`,
		presentation: 'ready' as const
	}));
	const placements = layoutVisitorMapLabels(items, 1, undefined, { height: 200, width: 300 });

	assert.ok(placements.length <= 8);

	for (const placement of placements) {
		assert.ok(placement.x >= 0);
		assert.ok(placement.y >= 0);
		assert.ok(placement.x + placement.width <= 300);
		assert.ok(placement.y + placement.height <= 200);
	}
});
