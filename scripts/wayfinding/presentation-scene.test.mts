import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPresentationScene } from '../../src/utils/wayfinding-presentation.js';

void test('builds the same translated presentation contract for authoring and runtime shapes', () => {
	const floor = {
		elements: [{
			destinationId: 'room-a',
			geometry: [
				{ x: 0, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 100 },
				{ x: 0, y: 100 }
			],
			id: 'location-a',
			type: 'location'
		}],
		height: 200,
		id: 'level-0',
		name: 'Ground floor',
		width: 300
	};
	const destination = {
		description: 'Visitor services',
		floor: floor.id,
		id: 'room-a',
		name: 'Information',
		translations: {
			hu: {
				description: 'Vendegszolgalat',
				name: 'Informacio'
			}
		}
	};
	const authoringScene = buildPresentationScene({
		defaultLanguage: 'en',
		destinations: [destination],
		floors: [floor],
		projectId: 'project-a'
	}, { floorId: floor.id, language: 'hu' });
	const runtimeScene = buildPresentationScene({
		defaultLanguage: 'en',
		destinations: [{
			...destination,
			floor: undefined,
			geometryRefs: [{ floorId: floor.id, representation: 'area' }]
		}],
		floors: [{ ...floor, svg: '<svg />' }],
		projectId: 'project-a'
	}, { floorId: floor.id, language: 'hu' });

	assert.deepEqual(runtimeScene.mapItems, authoringScene.mapItems);
	assert.deepEqual(runtimeScene.supersededLabelIds, authoringScene.supersededLabelIds);
	assert.equal(runtimeScene.destinations[0].name, 'Informacio');
	assert.equal(runtimeScene.destinations[0].description, 'Vendegszolgalat');
	assert.deepEqual(runtimeScene.mapItems[0].anchor, { x: 50, y: 50 });
});

void test('replaces authored destination-name labels while preserving unrelated map labels', () => {
	const scene = buildPresentationScene({
		destinations: [{
			floor: 'level-0',
			id: 'room-a',
			name: 'Welcome Center',
			translations: { hu: { name: 'Informacio' } }
		}],
		floors: [{
			elements: [
				{
					destinationId: 'room-a',
					geometry: [
						{ x: 0, y: 0 },
						{ x: 100, y: 0 },
						{ x: 100, y: 100 },
						{ x: 0, y: 100 }
					],
					id: 'location-a',
					type: 'location'
				},
				{ id: 'destination-name', point: { x: 50, y: 50 }, text: 'WELCOME CENTER', type: 'label' },
				{ id: 'wayfinding-note', point: { x: 50, y: 50 }, text: 'North wing', type: 'label' }
			],
			height: 100,
			id: 'level-0',
			name: 'Ground floor',
			width: 100
		}],
		projectId: 'project-a'
	}, { floorId: 'level-0', language: 'hu' });

	assert.deepEqual(scene.supersededLabelIds, ['destination-name']);
});
