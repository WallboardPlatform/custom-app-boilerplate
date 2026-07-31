import assert from 'node:assert/strict';
import test from 'node:test';

import { createWayfindingStudioProject } from '../../../../studio-project.mts';
import { getRouteReadiness } from './route-readiness.ts';

void test('new projects expose route setup without pretending a hidden mode is selected', () => {
	const project = createWayfindingStudioProject('New map');
	const readiness = getRouteReadiness(project, project.floors[0].id);

	assert.equal(readiness.status, 'not-configured');
	assert.deepEqual(
		readiness.buildBlockers.map((item) => item.action),
		['define-space', 'add-origin', 'add-destinations']
	);
	assert.deepEqual(readiness.blockers, readiness.buildBlockers);
});

void test('route setup explains every missing prerequisite', () => {
	const project = createWayfindingStudioProject('Route map');
	project.destinations.push({
		floor: project.floors[0].id,
		id: 'library',
		name: 'Library',
		routeable: true
	});
	const readiness = getRouteReadiness(project, project.floors[0].id);

	assert.deepEqual(
		readiness.blockers.map((item) => item.action),
		['define-space', 'add-origin', 'add-destinations']
	);
	assert.equal(readiness.routeableDestinations, 1);
	assert.equal(readiness.destinationAnchors, 0);
});

void test('mapped rooms require a linked public entrance before generation', () => {
	const project = createWayfindingStudioProject('Pre-generation map');
	const floor = project.floors[0];
	project.destinations.push(
		{
			floor: floor.id,
			id: 'mapped-library',
			name: 'Library',
			routeable: true
		},
		{
			floor: floor.id,
			id: 'directory-only-cafe',
			name: 'Cafe',
			routeable: true
		}
	);
	floor.elements.push(
		{
			destinationId: 'mapped-library',
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

	const readiness = getRouteReadiness(project, floor.id);

	assert.equal(readiness.buildBlockers.length, 1);
	assert.equal(readiness.buildBlockers[0].action, 'add-entrances');
	assert.equal(readiness.destinationAnchors, 1);
	assert.equal(readiness.mappedDestinationsOnFloor, 1);
	assert.equal(readiness.routeReadyDestinationsOnFloor, 0);
	assert.equal(readiness.unlinkedDestinationsOnFloor, 1);
	assert.equal(readiness.unpositionedDestinations, 1);
	assert.deepEqual(readiness.buildBlockers[0].target, {
		destinationId: 'mapped-library',
		elementId: 'library-room',
		floorId: floor.id
	});
	assert.equal(readiness.warnings.some((warning) =>
		warning.action === 'add-destinations'
		&& warning.body.includes('Cafe')
	), true);
});

void test('route readiness exposes generated coverage without hiding missing entrances', () => {
	const project = createWayfindingStudioProject('Connected route map');
	const floor = project.floors[0];
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
		reviewStatus: 'confirmed',
		to: 'library-node',
		traversal: 'indoor-corridor'
	});

	const readiness = getRouteReadiness(project, floor.id);

	assert.equal(readiness.connectedDestinations, 1);
	assert.equal(readiness.status, 'needs-work');
	assert.equal(readiness.warnings[0]?.action, 'add-entrances');
	assert.deepEqual(readiness.warnings[0]?.target, {
		destinationId: 'library',
		elementId: 'library-room',
		floorId: floor.id
	});
	assert.equal(readiness.warnings.some((warning) => warning.action === 'review-routes'), false);
});

void test('point destinations do not require a linked room entrance', () => {
	const project = createWayfindingStudioProject('Point destination map');
	const floor = project.floors[0];
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
		reviewStatus: 'confirmed',
		to: 'node-parking',
		traversal: 'indoor-corridor'
	});

	const readiness = getRouteReadiness(project, floor.id);

	assert.equal(readiness.warnings.some((warning) => warning.action === 'add-entrances'), false);
	assert.equal(readiness.connectedDestinations, 1);
});

void test('route readiness isolates a genuinely disconnected destination from entrance setup', () => {
	const project = createWayfindingStudioProject('Disconnected route map');
	const floor = project.floors[0];
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
			id: 'node-corridor',
			kind: 'route',
			levelId: floor.id,
			x: 40,
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
		distanceMeters: 20,
		from: 'node-origin',
		id: 'edge-corridor',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'node-corridor',
		traversal: 'indoor-corridor'
	});

	const readiness = getRouteReadiness(project, floor.id);
	const coverageWarning = readiness.warnings.find((warning) => warning.action === 'review-routes');

	assert.equal(readiness.warnings.some((warning) => warning.action === 'add-entrances'), false);
	assert.equal(coverageWarning?.title, 'This destination is unreachable');
	assert.deepEqual(coverageWarning?.target, {
		destinationId: 'parking',
		elementId: 'poi-parking',
		floorId: floor.id
	});
});
