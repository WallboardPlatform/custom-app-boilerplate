import assert from 'node:assert/strict';
import test from 'node:test';

import { createWayfindingStudioProject } from '../../studio-project.mts';
import { getRouteReadiness } from './route-readiness.ts';

void test('highlight projects do not invent routing blockers', () => {
	const project = createWayfindingStudioProject('Highlight map');
	const readiness = getRouteReadiness(project, project.floors[0].id);

	assert.equal(readiness.mode, 'highlight');
	assert.equal(readiness.status, 'highlight-ready');
	assert.deepEqual(readiness.blockers, []);
	assert.deepEqual(
		readiness.buildBlockers.map((item) => item.action),
		['define-space', 'add-origin', 'add-destinations']
	);
});

void test('route projects explain every missing prerequisite', () => {
	const project = createWayfindingStudioProject('Route map');
	project.delivery.guidance.targetMode = 'route';
	project.destinations.push({
		floor: project.floors[0].id,
		id: 'library',
		name: 'Library',
		routeable: true
	});
	const readiness = getRouteReadiness(project, project.floors[0].id);

	assert.deepEqual(
		readiness.blockers.map((item) => item.action),
		['define-space', 'add-origin', 'add-entrances']
	);
	assert.equal(readiness.routeableDestinations, 1);
	assert.equal(readiness.destinationAnchors, 0);
});

void test('route projects expose generated coverage without hiding missing entrances', () => {
	const project = createWayfindingStudioProject('Connected route map');
	const floor = project.floors[0];
	project.delivery.guidance.targetMode = 'route';
	project.destinations.push({
		floor: floor.id,
		id: 'library',
		name: 'Library',
		routeable: true
	});
	floor.elements.push(
		{
			destinationId: 'library',
			floorId: floor.id,
			geometry: [{ x: 40, y: 20 }, { x: 80, y: 20 }, { x: 80, y: 60 }, { x: 40, y: 60 }],
			id: 'library-room',
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'location'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'Main entrance screen',
			point: { x: 10, y: 40 },
			provenance: 'customer-source',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			floorId: floor.id,
			geometry: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
			id: 'walkable-main',
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'walkable'
		}
	);
	project.graph.nodes.push(
		{
			id: 'origin-node',
			kind: 'route',
			levelId: floor.id,
			semanticElementId: 'origin-main',
			x: 10,
			y: 40
		},
		{
			id: 'library-node',
			kind: 'location',
			levelId: floor.id,
			locationId: 'library',
			semanticElementId: 'library-room',
			x: 40,
			y: 40
		}
	);
	project.graph.edges.push({
		accessible: true,
		bidirectional: true,
		distanceMeters: 30,
		from: 'origin-node',
		id: 'route-main',
		kind: 'walk',
		to: 'library-node',
		traversal: 'indoor-corridor'
	});

	const readiness = getRouteReadiness(project, floor.id);

	assert.equal(readiness.connectedDestinations, 1);
	assert.equal(readiness.status, 'needs-work');
	assert.equal(readiness.warnings[0]?.action, 'add-entrances');
});

void test('point destinations do not require a linked room entrance', () => {
	const project = createWayfindingStudioProject('Point destination map');
	const floor = project.floors[0];
	project.delivery.guidance.targetMode = 'route';
	project.destinations.push({
		floor: floor.id,
		id: 'parking',
		name: 'Parking',
		routeable: true
	});
	floor.elements.push(
		{
			destinationId: 'parking',
			floorId: floor.id,
			id: 'poi-parking',
			point: { x: 80, y: 20 },
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'poi'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'Main screen',
			point: { x: 20, y: 20 },
			provenance: 'customer-source',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			floorId: floor.id,
			geometry: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
			id: 'walkable-main',
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'walkable'
		}
	);
	project.graph.nodes.push(
		{
			id: 'node-origin',
			kind: 'route',
			levelId: floor.id,
			semanticElementId: 'origin-main',
			x: 20,
			y: 20
		},
		{
			id: 'node-parking',
			kind: 'location',
			levelId: floor.id,
			locationId: 'parking',
			semanticElementId: 'poi-parking',
			x: 80,
			y: 20
		}
	);
	project.graph.edges.push({
		accessible: true,
		bidirectional: true,
		distanceMeters: 60,
		from: 'node-origin',
		id: 'edge-parking',
		kind: 'walk',
		to: 'node-parking'
	});

	const readiness = getRouteReadiness(project, floor.id);

	assert.equal(readiness.warnings.some((warning) => warning.action === 'add-entrances'), false);
	assert.equal(readiness.connectedDestinations, 1);
});
