import assert from 'node:assert/strict';
import test from 'node:test';

import type { WayfindingStudioDestination, WayfindingStudioFloor } from '../../../../studio-project.mts';
import {
	filterVisitorDestinations,
	visitorCategoryOptions,
	visitorFloorOptions
} from './visitor.ts';

const destinations: WayfindingStudioDestination[] = [
	{
		category: 'Dining',
		description: 'Coffee and light meals',
		floor: 'level-1',
		id: 'cafe',
		name: 'Cafe',
		translations: { hu: { description: 'Kave es etel', name: 'Kavezo' } }
	},
	{
		category: 'Services',
		floor: 'level-2',
		id: 'help',
		mapNumber: 'A-12',
		name: 'Guest services'
	}
];

void test('visitor filtering combines translated search, floor, and category', (): void => {
	assert.deepEqual(
		filterVisitorDestinations(destinations, {
			category: 'Dining',
			floorId: 'level-1',
			language: 'hu',
			query: 'kave'
		}).map((destination) => destination.id),
		['cafe']
	);
	assert.deepEqual(
		filterVisitorDestinations(destinations, {
			language: 'en',
			query: 'A-12'
		}).map((destination) => destination.id),
		['help']
	);
});

void test('visitor filters expose only used floors and stable categories', (): void => {
	const floors: WayfindingStudioFloor[] = [
		{ elements: [], height: 100, id: 'level-1', name: 'Ground floor', order: 0, width: 100 },
		{ elements: [], height: 100, id: 'level-2', name: 'First floor', order: 1, width: 100 },
		{ elements: [], height: 100, id: 'level-3', name: 'Unused floor', order: 2, width: 100 }
	];

	assert.deepEqual(visitorFloorOptions(floors, destinations).map((floor) => floor.id), ['level-1', 'level-2']);
	assert.deepEqual(visitorCategoryOptions(destinations), ['Dining', 'Services']);
});
