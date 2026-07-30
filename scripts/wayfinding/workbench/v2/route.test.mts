import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createWayfindingStudioProject,
	synchronizeWayfindingStudioGraph
} from '../../studio-project.mts';
import { cleanRoutePath, routeJourneyToDestination } from './route.ts';

void test('route cleanup removes duplicate points, loops, and redundant collinear bends', (): void => {
	const cleaned = cleanRoutePath([
		{ levelId: 'ground', x: 0, y: 0 },
		{ levelId: 'ground', x: 10, y: 0 },
		{ levelId: 'ground', x: 20, y: 0 },
		{ levelId: 'ground', x: 10, y: 0 },
		{ levelId: 'ground', x: 30, y: 0 },
		{ levelId: 'ground', x: 30, y: 0 },
		{ levelId: 'ground', x: 40, y: 0 }
	]);

	assert.deepEqual(cleaned, [
		{ levelId: 'ground', x: 0, y: 0 },
		{ levelId: 'ground', x: 40, y: 0 }
	]);
});

void test('route cleanup never simplifies across floor transitions', (): void => {
	const cleaned = cleanRoutePath([
		{ levelId: 'ground', x: 0, y: 0 },
		{ levelId: 'ground', x: 10, y: 0 },
		{ levelId: 'first', x: 10, y: 0 },
		{ levelId: 'first', x: 20, y: 0 }
	]);

	assert.deepEqual(cleaned, [
		{ levelId: 'ground', x: 0, y: 0 },
		{ levelId: 'ground', x: 10, y: 0 },
		{ levelId: 'first', x: 10, y: 0 },
		{ levelId: 'first', x: 20, y: 0 }
	]);
});

void test('route cleanup suppresses a microscopic generated lead-in before a long corridor', (): void => {
	const cleaned = cleanRoutePath([
		{ levelId: 'ground', x: 600, y: 380 },
		{ levelId: 'ground', x: 602.5, y: 377.5 },
		{ levelId: 'ground', x: 220, y: 377.5 },
		{ levelId: 'ground', x: 220, y: 330 }
	]);

	assert.deepEqual(cleaned, [
		{ levelId: 'ground', x: 600, y: 380 },
		{ levelId: 'ground', x: 220, y: 377.5 },
		{ levelId: 'ground', x: 220, y: 330 }
	]);
});

void test('route journey preserves ordered floors and explicit transitions', (): void => {
	const project = createWayfindingStudioProject('journey');
	const confirmed = { provenance: 'reviewer-authored' as const, status: 'confirmed' as const };
	project.floors = [
		{
			elements: [
				{
					...confirmed,
					facingDegrees: 0,
					floorId: 'ground',
					id: 'origin',
					label: 'Ground-floor kiosk',
					point: { x: 10, y: 20 },
					screenId: 'screen-ground',
					type: 'origin'
				},
				{
					...confirmed,
					accessible: true,
					connectionId: 'lift-a',
					floorId: 'ground',
					id: 'lift-ground',
					kind: 'elevator',
					label: 'Main lift',
					point: { x: 80, y: 20 },
					type: 'transition'
				}
			],
			height: 100,
			id: 'ground',
			name: 'Ground',
			order: 0,
			width: 100
		},
		{
			elements: [
				{
					...confirmed,
					accessible: true,
					connectionId: 'lift-a',
					floorId: 'first',
					id: 'lift-first',
					kind: 'elevator',
					label: 'Main lift',
					point: { x: 20, y: 20 },
					type: 'transition'
				},
				{
					...confirmed,
					destinationId: 'gallery',
					floorId: 'first',
					geometry: [{ x: 60, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 50 }, { x: 60, y: 50 }],
					id: 'gallery-location',
					type: 'location'
				}
			],
			height: 100,
			id: 'first',
			name: 'First',
			order: 1,
			width: 100
		}
	];
	project.destinations = [{ floor: 'first', id: 'gallery', name: 'Gallery', routeable: true }];
	synchronizeWayfindingStudioGraph(project);
	project.graph.edges.push(
		{
			accessible: true,
			bidirectional: true,
			from: 'semantic:origin',
			geometry: [{ x: 10, y: 20 }, { x: 80, y: 20 }],
			id: 'ground-walk',
			kind: 'walk',
			to: 'semantic:lift-ground'
		},
		{
			accessible: true,
			bidirectional: true,
			from: 'semantic:lift-first',
			geometry: [{ x: 20, y: 20 }, { x: 75, y: 30 }],
			id: 'first-walk',
			kind: 'walk',
			to: 'semantic:gallery-location'
		}
	);

	const journey = routeJourneyToDestination(project, 'gallery', 'step-free');

	assert.ok(journey);
	assert.deepEqual(journey.segments.map((segment) => segment.floorId), ['ground', 'first']);
	assert.deepEqual(journey.transitions, [{
		connectionId: 'lift-a',
		fromFloorId: 'ground',
		kind: 'elevator',
		toFloorId: 'first'
	}]);
	assert.deepEqual(journey.instructions.map((instruction) => instruction.kind), [
		'start',
		'continue',
		'transition',
		'continue',
		'arrive'
	]);
	assert.equal(journey.instructions[0]?.text, 'Start at Ground-floor kiosk.');
	assert.equal(journey.instructions.at(-1)?.text, 'Arrive at Gallery.');
	assert.equal(journey.result.nodeIds[0], 'semantic:origin');
	assert.equal(journey.result.nodeIds.at(-1), 'semantic:gallery-location');
	assert.deepEqual(journey.metrics, { calibrated: false });

	project.floors[0].unitsPerMeter = 10;
	project.floors[1].unitsPerMeter = 10;
	const calibratedJourney = routeJourneyToDestination(project, 'gallery', 'step-free');

	assert.deepEqual(calibratedJourney?.metrics, {
		calibrated: true,
		distanceMeters: 18,
		walkingSeconds: 13
	});
	assert.equal(calibratedJourney?.instructions[1]?.text, 'Continue for 7 m.');
});

void test('route journey uses the explicitly selected origin', (): void => {
	const project = createWayfindingStudioProject('multiple origins');
	const confirmed = { provenance: 'reviewer-authored' as const, status: 'confirmed' as const };
	project.floors[0].elements = [
		{ ...confirmed, facingDegrees: 0, floorId: 'level-0', id: 'origin-west', label: 'West kiosk', point: { x: 10, y: 50 }, screenId: 'west', type: 'origin' },
		{ ...confirmed, facingDegrees: 0, floorId: 'level-0', id: 'origin-east', label: 'East kiosk', point: { x: 90, y: 50 }, screenId: 'east', type: 'origin' },
		{
			...confirmed,
			destinationId: 'service-desk',
			floorId: 'level-0',
			geometry: [{ x: 42, y: 10 }, { x: 58, y: 10 }, { x: 58, y: 30 }, { x: 42, y: 30 }],
			id: 'service-location',
			type: 'location'
		}
	];
	project.destinations = [{ floor: 'level-0', id: 'service-desk', name: 'Service desk', routeable: true }];
	synchronizeWayfindingStudioGraph(project);
	project.graph.nodes.push({ id: 'junction', kind: 'route', levelId: 'level-0', x: 50, y: 50 });
	project.graph.edges.push(
		{
			accessible: true,
			bidirectional: true,
			from: 'semantic:origin-west',
			geometry: [{ x: 10, y: 50 }, { x: 50, y: 50 }],
			id: 'west-walk',
			kind: 'walk',
			to: 'junction'
		},
		{
			accessible: true,
			bidirectional: true,
			from: 'semantic:origin-east',
			geometry: [{ x: 90, y: 50 }, { x: 50, y: 50 }],
			id: 'east-walk',
			kind: 'walk',
			to: 'junction'
		},
		{
			accessible: true,
			bidirectional: true,
			from: 'junction',
			geometry: [{ x: 50, y: 50 }, { x: 50, y: 20 }],
			id: 'destination-walk',
			kind: 'walk',
			to: 'semantic:service-location'
		}
	);

	const fromEast = routeJourneyToDestination(project, 'service-desk', 'standard', 'origin-east');

	assert.ok(fromEast);
	assert.equal(fromEast.result.nodeIds[0], 'semantic:origin-east');
	assert.equal(fromEast.result.edgeIds[0], 'east-walk');
});
