import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createWayfindingStudioProject,
	wayfindingStudioProjectDefaults
} from '../../../studio-project.mts';
import { buildPolygonAuthoring } from './authoring.ts';

void test('placing a selected directory destination reuses it instead of creating a duplicate', () => {
	const project = createWayfindingStudioProject('Link existing destination');
	const floor = project.floors[0];
	project.destinations.push({
		id: 'directory-library',
		name: 'Library',
		routeable: true
	});

	const result = buildPolygonAuthoring({
		createId: (prefix) => `${prefix}-new`,
		defaults: wayfindingStudioProjectDefaults(project),
		elementType: 'location',
		floorId: floor.id,
		geometry: [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }],
		project,
		selectedDestinationId: 'directory-library'
	});
	const elementCommand = result.transaction.commands.find((command) => command.type === 'element/add');

	assert.equal(result.transaction.commands.some((command) => command.type === 'destination/add'), false);
	assert.deepEqual(
		result.transaction.commands.find((command) => command.type === 'destination/patch'),
		{
			destinationId: 'directory-library',
			patch: { floor: floor.id },
			type: 'destination/patch'
		}
	);
	assert.equal(
		elementCommand?.type === 'element/add' && 'destinationId' in elementCommand.element
			? elementCommand.element.destinationId
			: undefined,
		'directory-library'
	);
	assert.equal(result.transaction.label, 'Place Library');
});
