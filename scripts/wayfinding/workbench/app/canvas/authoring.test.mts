import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createWayfindingStudioProject,
	wayfindingStudioProjectDefaults
} from '../../../studio-project.mts';
import {
	buildPointAuthoring,
	buildPolygonAuthoring,
	resolveDoorPlacement
} from './authoring.ts';

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

void test('doors snap exactly to the nearest room edge and relink while dragging between rooms', () => {
	const project = createWayfindingStudioProject('Door snapping');
	const floor = project.floors[0];
	floor.width = 600;
	floor.height = 400;
	floor.elements.push(
		{
			floorId: floor.id,
			geometry: [{ x: 40, y: 40 }, { x: 220, y: 40 }, { x: 220, y: 180 }, { x: 40, y: 180 }],
			id: 'room-a',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			floorId: floor.id,
			geometry: [{ x: 320, y: 80 }, { x: 520, y: 80 }, { x: 520, y: 260 }, { x: 320, y: 260 }],
			id: 'room-b',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		}
	);

	const placement = resolveDoorPlacement(project, floor.id, { x: 331, y: 172 }, 'room-a');

	assert.equal(placement.location?.id, 'room-b');
	assert.deepEqual(placement.point, { x: 320, y: 172 });
	assert.equal(Math.abs(placement.angle), 90);

	const authored = buildPointAuthoring({
		createId: (prefix) => `${prefix}-new`,
		defaults: wayfindingStudioProjectDefaults(project),
		destinationCount: 0,
		floorId: floor.id,
		point: { x: 331, y: 172 },
		project,
		selectedElementId: 'room-a',
		tool: 'door'
	});

	assert.ok(authored);
	assert.equal(authored.element.type, 'door');
	assert.equal(authored.element.type === 'door' ? authored.element.locationId : undefined, 'room-b');
	assert.deepEqual('point' in authored.element ? authored.element.point : undefined, { x: 320, y: 172 });
});

void test('doors remain unassigned when no room boundary is within the visible snap radius', () => {
	const project = createWayfindingStudioProject('Detached door');
	const floor = project.floors[0];
	floor.width = 1_000;
	floor.height = 700;
	floor.elements.push({
		floorId: floor.id,
		geometry: [{ x: 40, y: 40 }, { x: 220, y: 40 }, { x: 220, y: 180 }, { x: 40, y: 180 }],
		id: 'room-a',
		provenance: 'reviewer-authored',
		status: 'confirmed',
		type: 'location'
	});

	const placement = resolveDoorPlacement(project, floor.id, { x: 800, y: 500 });

	assert.equal(placement.location, undefined);
	assert.deepEqual(placement.point, { x: 800, y: 500 });
});
