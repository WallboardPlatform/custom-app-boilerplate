import assert from 'node:assert/strict';
import test from 'node:test';

import { createWayfindingStudioProject } from '../../studio-project.mts';
import type { EditorLayerId } from '../../editor-core/types.ts';
import { presentationSceneProject } from './features/preview/presentation-scene.ts';

const visibility = (visible = true): Record<EditorLayerId, boolean> => ({
	background: visible,
	door: visible,
	icon: visible,
	label: visible,
	location: visible,
	logo: visible,
	obstacle: visible,
	origin: visible,
	poi: visible,
	'route-network': visible,
	'simulated-route': visible,
	transition: visible,
	walkable: visible
});

void test('visitor scene keeps presentation layers and removes authoring evidence', () => {
	const project = createWayfindingStudioProject('visitor-scene');
	const floor = project.floors[0];
	floor.elements = [
		{
			floorId: floor.id,
			geometry: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
			id: 'location-1',
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'location'
		},
		{
			floorId: floor.id,
			geometry: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
			id: 'walkable-1',
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			floorId: floor.id,
			id: 'origin-1',
			defaultLanguage: 'en',
			facingDegrees: 0,
			label: 'You are here',
			point: { x: 50, y: 50 },
			provenance: 'customer-source',
			screenId: 'screen-1',
			status: 'confirmed',
			type: 'origin'
		},
		{
			floorId: floor.id,
			id: 'label-1',
			point: { x: 50, y: 50 },
			provenance: 'customer-source',
			status: 'confirmed',
			text: 'Directory',
			type: 'label'
		}
	];

	const projected = presentationSceneProject(project, visibility());
	assert.deepEqual(projected.floors[0].elements.map((element) => element.id), [
		'location-1',
		'walkable-1',
		'origin-1',
		'label-1'
	]);
	assert.equal(project.floors[0].elements.length, 4);
});

void test('visitor scene honors label and media visibility without hiding locations', () => {
	const project = createWayfindingStudioProject('visitor-scene');
	const floor = project.floors[0];
	project.languages = [
		{ code: 'en', label: 'English' },
		{ code: 'hu', label: 'Magyar' }
	];
	project.destinations = [{
		floor: floor.id,
		id: 'destination-information',
		mapNumber: 'A-12',
		name: 'Visitor information',
		routeable: true,
		translations: { hu: { name: 'Információ' } }
	}];
	floor.elements = [
		{
			destinationId: 'destination-information',
			floorId: floor.id,
			geometry: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
			id: 'location-1',
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'location'
		},
		{
			floorId: floor.id,
			id: 'label-1',
			point: { x: 50, y: 50 },
			provenance: 'customer-source',
			status: 'confirmed',
			text: 'Directory',
			type: 'label'
		},
		{
			floorId: floor.id,
			id: 'destination-name-label',
			point: { x: 50, y: 50 },
			provenance: 'customer-source',
			status: 'confirmed',
			text: 'Visitor information',
			type: 'label'
		},
		{
			destinationId: 'destination-information',
			floorId: floor.id,
			id: 'poi-1',
			label: 'Information point',
			point: { x: 25, y: 25 },
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'poi'
		},
		{
			accessible: true,
			connectionId: 'lift-main',
			floorId: floor.id,
			id: 'transition-1',
			kind: 'elevator',
			label: 'Main elevator',
			point: { x: 75, y: 75 },
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'transition'
		}
	];
	const original = structuredClone(project);
	const layers = visibility();
	layers.location = false;

	const projected = presentationSceneProject(project, layers, 'hu');
	assert.deepEqual(
		projected.floors[0].elements.map((element) => element.id),
		[
			'location-1',
			'label-1',
			'poi-1',
			'transition-1',
			'presentation-destination-label:destination-information'
		]
	);
	const destinationLabel = projected.floors[0].elements.find(
		(element) => element.id === 'presentation-destination-label:destination-information'
	);
	assert.equal(destinationLabel?.type, 'label');
	assert.equal(destinationLabel?.type === 'label' ? destinationLabel.text : undefined, 'A-12  Információ');
	assert.deepEqual(project, original);

	layers.label = false;
	assert.deepEqual(
		presentationSceneProject(project, layers, 'hu').floors[0].elements.map((element) => element.id),
		['location-1', 'poi-1', 'transition-1']
	);
});

void test('visitor 3D scene projects destination symbols as camera-facing media', () => {
	const project = createWayfindingStudioProject('visitor-symbol-scene');
	const floor = project.floors[0];
	project.assets.push({
		dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
		id: 'symbol-cafe',
		kind: 'icon',
		mimeType: 'image/svg+xml',
		name: 'Cafe',
		naturalHeight: 64,
		naturalWidth: 64
	});
	project.destinations.push({
		floor: floor.id,
		id: 'destination-cafe',
		name: 'Cafe',
		symbolAssetId: 'symbol-cafe'
	});
	floor.elements.push({
		destinationId: 'destination-cafe',
		floorId: floor.id,
		id: 'poi-cafe',
		point: { x: 100, y: 80 },
		provenance: 'reviewer-authored',
		status: 'confirmed',
		type: 'poi'
	});

	const projected = presentationSceneProject(project, visibility());
	const symbol = projected.floors[0].elements.find(
		(element) => element.id === 'presentation-destination-symbol:destination-cafe'
	);

	assert.equal(symbol?.type, 'icon');
	assert.equal(symbol && 'assetId' in symbol ? symbol.assetId : undefined, 'symbol-cafe');
	assert.equal(symbol && 'destinationId' in symbol ? symbol.destinationId : undefined, 'destination-cafe');
});
