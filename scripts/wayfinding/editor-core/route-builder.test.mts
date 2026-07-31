import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { WayfindingGraph } from '../../../src/utils/wayfinding.js';

import {
	createWayfindingStudioProject,
	synchronizeWayfindingStudioGraph,
	validateWayfindingStudioPublish,
	type WayfindingStudioFloor,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioProject
} from '../studio-project.mts';
import {
	inspectRouteGeometry,
	measureRouteNetwork
} from '../workbench/app/features/routing/route-geometry.ts';
import {
	createComplexConcourseFixture,
	WAYFINDING_PROJECT_7_REFERENCE_SIZE
} from './fixtures/complex-concourse.mts';
import { createIrregularAtriumFixture } from './fixtures/irregular-atrium.mts';
import { buildFloorRouteNetwork } from './route-builder.mts';

const createRebuildFixture = (): {
	floor: WayfindingStudioFloor;
	project: WayfindingStudioProject;
} => {
	const project = createWayfindingStudioProject('Route rebuild ownership test');
	const floor = project.floors[0];
	floor.width = 320;
	floor.height = 180;
	floor.unitsPerMeter = 10;
	floor.elements.push(
		{
			floorId: floor.id,
			geometry: [
				{ x: 20, y: 40 },
				{ x: 300, y: 40 },
				{ x: 300, y: 140 },
				{ x: 20, y: 140 }
			],
			id: 'walkable-main',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 40, y: 90 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			destinationId: 'destination-room-a',
			floorId: floor.id,
			geometry: [
				{ x: 280, y: 60 },
				{ x: 318, y: 60 },
				{ x: 318, y: 120 },
				{ x: 280, y: 120 }
			],
			id: 'room-a',
			label: 'Room A',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			angle: 90,
			floorId: floor.id,
			id: 'door-room-a',
			length: 42,
			locationId: 'room-a',
			point: { x: 280, y: 90 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		}
	);
	project.destinations.push({
		floor: floor.id,
		id: 'destination-room-a',
		name: 'Room A',
		routeable: true
	});
	synchronizeWayfindingStudioGraph(project);

	return { floor, project };
};

void test('builds a contained route graph and connects semantic anchors', () => {
	const project = createWayfindingStudioProject('Route test');
	const floor = project.floors[0];
	floor.width = 320;
	floor.height = 180;
	floor.unitsPerMeter = 10;
	floor.elements.push(
		{
			floorId: floor.id,
			geometry: [
				{ x: 20, y: 40 },
				{ x: 300, y: 40 },
				{ x: 300, y: 140 },
				{ x: 20, y: 140 }
			],
			id: 'walkable-main',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 40, y: 90 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			destinationId: 'destination-room-a',
			floorId: floor.id,
			geometry: [
				{ x: 280, y: 60 },
				{ x: 318, y: 60 },
				{ x: 318, y: 120 },
				{ x: 280, y: 120 }
			],
			id: 'room-a',
			label: 'Room A',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			angle: 90,
			floorId: floor.id,
			id: 'door-room-a',
			length: 42,
			locationId: 'room-a',
			point: { x: 280, y: 90 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		}
	);
	project.destinations.push({
		floor: floor.id,
		id: 'destination-room-a',
		name: 'Room A',
		routeable: true
	});
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6 });
	const originNode = result.project.graph.nodes.find((node) => node.semanticElementId === 'origin-main');
	const doorNode = result.project.graph.nodes.find((node) => node.semanticElementId === 'room-a');

	assert.ok(result.nodes > 0);
	assert.ok(result.edges > 0);
	assert.equal(result.connectedSemanticNodes, result.totalSemanticNodes);
	assert.deepEqual(result.diagnostics, []);
	assert.deepEqual(result.stages.map((stage) => stage.id), [
		'space-normalization',
		'clearance',
		'topology',
		'entrance-connection',
		'pruning',
		'safe-simplification',
		'validation'
	]);
	assert.ok(originNode);
	assert.ok(doorNode);
	assert.ok(result.project.graph.edges.some((edge) => edge.from === originNode.id || edge.to === originNode.id));
	assert.ok(result.project.graph.edges.some((edge) => edge.from === doorNode.id || edge.to === doorNode.id));

	for (const edge of result.project.graph.edges.filter((candidate) => candidate.id.startsWith(`generated:${floor.id}:edge:`))) {
		assert.ok(edge.geometry && edge.geometry.length >= 2);

		for (const point of edge.geometry) {
			assert.ok(point.x >= 20 && point.x <= 300);
			assert.ok(point.y >= 40 && point.y <= 140);
		}
	}
});

void test('only writes generated route distances after the floor scale is calibrated', () => {
	const { floor, project } = createRebuildFixture();
	delete floor.unitsPerMeter;

	const uncalibrated = buildFloorRouteNetwork(project, floor.id, { cellSize: 6 });
	const uncalibratedEdges = uncalibrated.project.graph.edges.filter((edge) =>
		edge.authoringOwnership === 'generated'
	);

	assert.ok(uncalibratedEdges.length > 0);
	assert.equal(
		uncalibratedEdges.every((edge) => edge.distanceMeters === undefined),
		true
	);

	uncalibrated.project.floors[0].unitsPerMeter = 8;
	const calibrated = buildFloorRouteNetwork(uncalibrated.project, floor.id, { cellSize: 6 });
	const calibratedEdges = calibrated.project.graph.edges.filter((edge) =>
		edge.authoringOwnership === 'generated'
	);

	assert.ok(calibratedEdges.length > 0);
	assert.equal(
		calibratedEdges.every((edge) =>
			edge.distanceMeters !== undefined && edge.distanceMeters > 0
		),
		true
	);
});

void test('ignores a detached door instead of inventing a route connector', () => {
	const project = createWayfindingStudioProject('Route diagnostics test');
	const floor = project.floors[0];
	floor.width = 320;
	floor.height = 220;
	floor.elements.push(
		{
			floorId: floor.id,
			geometry: [
				{ x: 20, y: 80 },
				{ x: 300, y: 80 },
				{ x: 300, y: 200 },
				{ x: 20, y: 200 }
			],
			id: 'walkable-main',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 40, y: 140 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			angle: 0,
			floorId: floor.id,
			id: 'door-detached',
			length: 36,
			locationId: 'room-detached',
			point: { x: 160, y: 10 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		}
	);
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 5 });
	const detachedDoorNode = result.project.graph.nodes.find(
		(node) => node.semanticElementId === 'door-detached'
	);

	assert.equal(result.connectedSemanticNodes, result.totalSemanticNodes);
	assert.equal(result.totalSemanticNodes, 1);
	assert.deepEqual(result.diagnostics, []);
	assert.equal(detachedDoorNode, undefined);
});

void test('connects entrances through walkable space instead of cutting across obstacles', () => {
	const project = createWayfindingStudioProject('Obstacle route test');
	const floor = project.floors[0];
	floor.width = 360;
	floor.height = 220;
	floor.unitsPerMeter = 10;
	floor.elements.push(
		{
			floorId: floor.id,
			geometry: [
				{ x: 20, y: 20 },
				{ x: 340, y: 20 },
				{ x: 340, y: 200 },
				{ x: 20, y: 200 }
			],
			id: 'walkable-main',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			floorId: floor.id,
			geometry: [
				{ x: 145, y: 55 },
				{ x: 215, y: 55 },
				{ x: 215, y: 165 },
				{ x: 145, y: 165 }
			],
			id: 'obstacle-island',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'obstacle'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 40, y: 110 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			destinationId: 'destination-room-a',
			floorId: floor.id,
			geometry: [
				{ x: 320, y: 70 },
				{ x: 358, y: 70 },
				{ x: 358, y: 150 },
				{ x: 320, y: 150 }
			],
			id: 'room-a',
			label: 'Room A',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			angle: 90,
			floorId: floor.id,
			id: 'door-room-a',
			length: 42,
			locationId: 'room-a',
			point: { x: 320, y: 110 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		}
	);
	project.destinations.push({
		floor: floor.id,
		id: 'destination-room-a',
		name: 'Room A',
		routeable: true
	});
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 5 });
	const generatedEdges = result.project.graph.edges.filter((edge) =>
		edge.id.startsWith(`generated:${floor.id}:`)
	);

	for (const edge of generatedEdges) {
		const geometry = edge.geometry ?? [];

		for (let index = 1; index < geometry.length; index += 1) {
			const left = geometry[index - 1];
			const right = geometry[index];
			const steps = Math.max(1, Math.ceil(Math.hypot(right.x - left.x, right.y - left.y) / 2));

			for (let step = 1; step <= steps; step += 1) {
				const ratio = step / steps;
				const point = {
					x: left.x + (right.x - left.x) * ratio,
					y: left.y + (right.y - left.y) * ratio
				};
				const insideObstacle = point.x > 145 && point.x < 215 && point.y > 55 && point.y < 165;

				assert.equal(insideObstacle, false, `${edge.id} crossed the central obstacle at ${point.x},${point.y}`);
			}
		}
	}
});

void test('projects a door connector through the walkable side of the doorway', () => {
	const project = createWayfindingStudioProject('Door orientation test');
	const floor = project.floors[0];
	floor.width = 320;
	floor.height = 200;
	floor.unitsPerMeter = 10;
	floor.elements.push(
		{
			floorId: floor.id,
			geometry: [
				{ x: 20, y: 60 },
				{ x: 300, y: 60 },
				{ x: 300, y: 170 },
				{ x: 20, y: 170 }
			],
			id: 'walkable-corridor',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 40, y: 120 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			destinationId: 'destination-room-north',
			floorId: floor.id,
			geometry: [
				{ x: 120, y: 0 },
				{ x: 200, y: 0 },
				{ x: 200, y: 60 },
				{ x: 120, y: 60 }
			],
			id: 'room-north',
			label: 'North room',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			angle: 0,
			floorId: floor.id,
			id: 'door-north',
			length: 42,
			locationId: 'room-north',
			point: { x: 160, y: 60 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		}
	);
	project.destinations.push({
		floor: floor.id,
		id: 'destination-room-north',
		name: 'North room',
		routeable: true
	});
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6, clearanceCells: 1 });
	const doorNode = result.project.graph.nodes.find((node) => node.semanticElementId === 'room-north');
	const connector = result.project.graph.edges.find((edge) =>
		doorNode && edge.id === `generated:${floor.id}:connector:${doorNode.id}`
	);

	assert.ok(doorNode);
	assert.ok(connector?.geometry);
	assert.ok(connector.geometry.length >= 2);
	const firstWalkablePoint = connector.geometry[1];

	assert.ok(firstWalkablePoint.y > doorNode.y, 'door connector must enter the corridor below the door');
	assert.ok(
		Math.abs(firstWalkablePoint.x - doorNode.x) <= 6,
		'door connector must begin perpendicular to the door instead of moving sideways'
	);
});

void test('connects point anchors directly without a cell-center backtracking kink', () => {
	const project = createWayfindingStudioProject('Direct point connector test');
	const floor = project.floors[0];
	floor.width = 320;
	floor.height = 200;
	floor.unitsPerMeter = 10;
	floor.elements.push(
		{
			floorId: floor.id,
			geometry: [
				{ x: 20, y: 60 },
				{ x: 300, y: 60 },
				{ x: 300, y: 170 },
				{ x: 20, y: 170 }
			],
			id: 'walkable-corridor',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 160, y: 116 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			destinationId: 'destination-room-north',
			floorId: floor.id,
			geometry: [
				{ x: 220, y: 0 },
				{ x: 300, y: 0 },
				{ x: 300, y: 60 },
				{ x: 220, y: 60 }
			],
			id: 'room-north',
			label: 'North room',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			angle: 0,
			floorId: floor.id,
			id: 'door-north',
			length: 42,
			locationId: 'room-north',
			point: { x: 260, y: 60 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		}
	);
	project.destinations.push({
		floor: floor.id,
		id: 'destination-room-north',
		name: 'North room',
		routeable: true
	});
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6, clearanceCells: 1 });
	const originNode = result.project.graph.nodes.find((node) => node.semanticElementId === 'origin-main');
	const connector = result.project.graph.edges.find((edge) =>
		originNode && edge.id === `generated:${floor.id}:connector:${originNode.id}`
	);

	assert.ok(connector?.geometry);
	assert.equal(connector.geometry.length, 2);
});

void test('does not duplicate the connector for a destination and its linked door', () => {
	const project = createWayfindingStudioProject('Canonical doorway route test');
	const floor = project.floors[0];
	floor.width = 320;
	floor.height = 200;
	floor.unitsPerMeter = 10;
	project.destinations.push({
		floor: floor.id,
		id: 'room-north',
		name: 'Room north',
		routeable: true
	});
	floor.elements.push(
		{
			floorId: floor.id,
			geometry: [
				{ x: 20, y: 60 },
				{ x: 300, y: 60 },
				{ x: 300, y: 170 },
				{ x: 20, y: 170 }
			],
			id: 'walkable-corridor',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			destinationId: 'room-north',
			floorId: floor.id,
			geometry: [
				{ x: 120, y: 10 },
				{ x: 200, y: 10 },
				{ x: 200, y: 60 },
				{ x: 120, y: 60 }
			],
			id: 'room-north-shape',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 40, y: 120 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			angle: 0,
			floorId: floor.id,
			id: 'door-north',
			length: 42,
			locationId: 'room-north-shape',
			point: { x: 160, y: 60 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		}
	);
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6, clearanceCells: 1 });
	const destinationNode = result.project.graph.nodes.find((node) => node.locationId === 'room-north');
	const destinationConnectors = result.project.graph.edges.filter((edge) =>
		destinationNode
		&& edge.id === `generated:${floor.id}:connector:${destinationNode.id}`
	);

	assert.ok(destinationNode);
	assert.equal(result.totalSemanticNodes, 2);
	assert.equal(destinationConnectors.length, 1);
	assert.equal(
		result.project.graph.nodes.some((node) => node.semanticElementId === 'door-north'),
		false
	);
});

void test('does not replace a curved centerline with a long diagonal shortcut', () => {
	const project = createWayfindingStudioProject('Shape preserving route test');
	const floor = project.floors[0];
	floor.width = 320;
	floor.height = 260;
	floor.unitsPerMeter = 10;
	floor.elements.push(
		{
			floorId: floor.id,
			geometry: [
				{ x: 20, y: 20 },
				{ x: 130, y: 20 },
				{ x: 130, y: 150 },
				{ x: 300, y: 150 },
				{ x: 300, y: 240 },
				{ x: 20, y: 240 }
			],
			id: 'walkable-dogleg',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 50, y: 60 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			angle: 90,
			floorId: floor.id,
			id: 'door-east',
			length: 42,
			locationId: 'room-east',
			point: { x: 300, y: 200 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		}
	);
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 5, clearanceCells: 1 });
	const generatedEdges = result.project.graph.edges.filter((edge) =>
		edge.id.startsWith(`generated:${floor.id}:`)
	);

	for (const edge of generatedEdges) {
		const geometry = edge.geometry ?? [];

		for (let index = 1; index < geometry.length; index += 1) {
			const left = geometry[index - 1];
			const right = geometry[index];
			const isLongDiagonal = Math.abs(right.x - left.x) > 45 && Math.abs(right.y - left.y) > 45;

			assert.equal(isLongDiagonal, false, `${edge.id} replaced the dogleg with a long diagonal`);
		}
	}
});

void test('preserves hand-authored route points and segments during generation', () => {
	const { floor, project } = createRebuildFixture();
	project.graph.nodes.push(
		{
			authoringOwnership: 'manual',
			id: 'manual-node-a',
			kind: 'route',
			levelId: floor.id,
			x: 100,
			y: 100
		},
		{
			authoringOwnership: 'manual',
			id: 'manual-node-b',
			kind: 'route',
			levelId: floor.id,
			x: 130,
			y: 100
		}
	);
	project.graph.edges.push({
		accessible: true,
		authoringOwnership: 'manual',
		bidirectional: true,
		from: 'manual-node-a',
		geometry: [{ x: 100, y: 100 }, { x: 115, y: 96 }, { x: 130, y: 100 }],
		id: 'manual-edge-a',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'manual-node-b',
		traversal: 'indoor-corridor'
	});

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6 });

	assert.deepEqual(
		result.project.graph.nodes.filter((node) => node.id.startsWith('manual-node')),
		project.graph.nodes.filter((node) => node.id.startsWith('manual-node'))
	);
	assert.deepEqual(
		result.project.graph.edges.find((edge) => edge.id === 'manual-edge-a'),
		project.graph.edges.find((edge) => edge.id === 'manual-edge-a')
	);
	assert.equal(result.diff.manualNodesPreserved, 2);
	assert.equal(result.diff.manualEdgesPreserved, 1);
	const adjacency = new Map<string, string[]>();

	for (const edge of result.project.graph.edges) {
		adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), edge.to]);

		if (edge.bidirectional) {
			adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), edge.from]);
		}
	}
	const originId = result.project.graph.nodes.find((node) =>
		node.semanticElementId === 'origin-main'
	)?.id;
	const reachable = new Set(originId ? [originId] : []);
	const queue = [...reachable];

	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		for (const neighbor of adjacency.get(queue[cursor]) ?? []) {
			if (reachable.has(neighbor)) continue;
			reachable.add(neighbor);
			queue.push(neighbor);
		}
	}
	assert.equal(reachable.has('manual-node-a'), true);
	assert.equal(reachable.has('manual-node-b'), true);
});

void test('rejects a reviewed manual segment that leaves pedestrian space', () => {
	const { floor, project } = createRebuildFixture();
	project.graph.nodes.push(
		{
			authoringOwnership: 'manual',
			id: 'manual-outside-a',
			kind: 'route',
			levelId: floor.id,
			x: 90,
			y: 90
		},
		{
			authoringOwnership: 'manual',
			id: 'manual-outside-b',
			kind: 'route',
			levelId: floor.id,
			x: 90,
			y: 15
		}
	);
	project.graph.edges.push({
		accessible: true,
		authoringOwnership: 'manual',
		bidirectional: true,
		from: 'manual-outside-a',
		geometry: [{ x: 90, y: 90 }, { x: 90, y: 15 }],
		id: 'manual-outside-edge',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'manual-outside-b',
		traversal: 'indoor-corridor'
	});

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6 });

	assert.ok(result.diagnostics.some((diagnostic) =>
		diagnostic.code === 'route-geometry-invalid'
			&& diagnostic.message.includes('manual-outside-edge')
	));
	assert.ok(result.diagnostics.some((diagnostic) =>
		diagnostic.code === 'manual-segment-disconnected'
			&& diagnostic.nodeId === 'manual-outside-b'
	));
});

void test('preserves reviewed corrections to generated topology without duplicate IDs', () => {
	const { floor, project } = createRebuildFixture();
	const firstBuild = buildFloorRouteNetwork(project, floor.id, { cellSize: 6 });
	const correctedProject = firstBuild.project;
	const correctedEdge = correctedProject.graph.edges.find((edge) =>
		edge.id.startsWith(`generated:${floor.id}:edge:`)
	);

	assert.ok(correctedEdge?.geometry);
	const correctedNode = correctedProject.graph.nodes.find((node) => node.id === correctedEdge.from);

	assert.ok(correctedNode);
	correctedNode.authoringOwnership = 'manual';
	correctedNode.x += 4;
	correctedNode.y -= 3;
	correctedEdge.authoringOwnership = 'manual';
	correctedEdge.reviewStatus = 'confirmed';
	correctedEdge.geometry = [
		{ x: correctedNode.x, y: correctedNode.y },
		{ x: correctedNode.x + 12, y: correctedNode.y + 2 },
		{ ...correctedEdge.geometry.at(-1)! }
	];
	const expectedNode = structuredClone(correctedNode);
	const expectedEdge = structuredClone(correctedEdge);

	const rebuilt = buildFloorRouteNetwork(correctedProject, floor.id, { cellSize: 6 });

	assert.deepEqual(rebuilt.project.graph.nodes.find((node) => node.id === expectedNode.id), expectedNode);
	assert.deepEqual(rebuilt.project.graph.edges.find((edge) => edge.id === expectedEdge.id), expectedEdge);
	assert.equal(rebuilt.project.graph.nodes.filter((node) => node.id === expectedNode.id).length, 1);
	assert.equal(rebuilt.project.graph.edges.filter((edge) => edge.id === expectedEdge.id).length, 1);
	assert.ok(rebuilt.diff.manualNodesPreserved >= 1);
	assert.ok(rebuilt.diff.manualEdgesPreserved >= 1);
});

void test('reports anchors in disconnected pedestrian regions as unreachable', () => {
	const { floor, project } = createRebuildFixture();
	const walkable = floor.elements.find((element) => element.type === 'walkable');

	assert.ok(walkable?.type === 'walkable');
	walkable.geometry = [
		{ x: 20, y: 40 },
		{ x: 120, y: 40 },
		{ x: 120, y: 140 },
		{ x: 20, y: 140 }
	];
	floor.elements.push({
		floorId: floor.id,
		geometry: [
			{ x: 220, y: 40 },
			{ x: 300, y: 40 },
			{ x: 300, y: 140 },
			{ x: 220, y: 140 }
		],
		id: 'walkable-island',
		provenance: 'reviewer-authored',
		status: 'confirmed',
		type: 'walkable'
	});
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 5 });

	assert.ok(result.connectedSemanticNodes < result.totalSemanticNodes);
	assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'network-disconnected'));
});

void test('keeps a narrow valid corridor route instead of eroding it away', () => {
	const { floor, project } = createRebuildFixture();
	const walkable = floor.elements.find((element) => element.type === 'walkable');

	assert.ok(walkable?.type === 'walkable');
	walkable.geometry = [
		{ x: 20, y: 80 },
		{ x: 300, y: 80 },
		{ x: 300, y: 105 },
		{ x: 20, y: 105 }
	];
	const origin = floor.elements.find((element) => element.type === 'origin');
	const door = floor.elements.find((element) => element.type === 'door');

	assert.ok(origin?.type === 'origin');
	assert.ok(door?.type === 'door');
	origin.point = { x: 40, y: 92 };
	door.point = { x: 280, y: 92 };
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, {
		cellSize: 5,
		clearanceCells: 2
	});

	assert.equal(result.connectedSemanticNodes, result.totalSemanticNodes);
	assert.ok(result.edges > 0);
});

void test('rebuilding one floor leaves every other floor route unchanged', () => {
	const { floor, project } = createRebuildFixture();
	const upperFloor = {
		...structuredClone(floor),
		elements: [],
		id: 'level-1',
		name: 'Level 1',
		order: 1
	};
	project.floors.push(upperFloor);
	project.graph.nodes.push(
		{
			authoringOwnership: 'generated',
			id: 'generated:level-1:node:1',
			kind: 'route',
			levelId: upperFloor.id,
			x: 40,
			y: 40
		},
		{
			authoringOwnership: 'generated',
			id: 'generated:level-1:node:2',
			kind: 'route',
			levelId: upperFloor.id,
			x: 80,
			y: 40
		}
	);
	project.graph.edges.push({
		accessible: true,
		authoringOwnership: 'generated',
		bidirectional: true,
		from: 'generated:level-1:node:1',
		geometry: [{ x: 40, y: 40 }, { x: 80, y: 40 }],
		id: 'generated:level-1:edge:1',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'generated:level-1:node:2',
		traversal: 'indoor-corridor'
	});
	const expectedUpperNodes = structuredClone(project.graph.nodes.filter((node) => node.levelId === upperFloor.id));
	const expectedUpperEdges = structuredClone(project.graph.edges.filter((edge) => edge.id.startsWith('generated:level-1:')));

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6 });

	assert.deepEqual(result.project.graph.nodes.filter((node) => node.levelId === upperFloor.id), expectedUpperNodes);
	assert.deepEqual(result.project.graph.edges.filter((edge) => edge.id.startsWith('generated:level-1:')), expectedUpperEdges);
});

void test('keeps the maintained campus fixture clean and fully connected', () => {
	const project = JSON.parse(fs.readFileSync(
		new URL('../../../examples/spatial-wayfinding/source/campus.wbwayfinding', import.meta.url),
		'utf8'
	)) as WayfindingStudioProject;
	const result = buildFloorRouteNetwork(project, 'ground');
	const geometryIssues = result.project.graph.edges.flatMap((edge) =>
		inspectRouteGeometry(edge, result.project.graph.nodes)
	);
	const quality = measureRouteNetwork(
		result.project.graph.edges,
		result.project.graph.nodes
	);

	assert.equal(result.connectedSemanticNodes, 7);
	assert.equal(result.totalSemanticNodes, 7);
	assert.deepEqual(result.diagnostics, []);
	assert.deepEqual(geometryIssues, []);
	assert.equal(quality.score, 100);
});

void test('rebuilds a complex concourse without stale loops, obstacle crossings, or missing entrances', () => {
	const project = createComplexConcourseFixture();
	const result = buildFloorRouteNetwork(project, 'level-0', {
		cellSize: 6,
		clearanceCells: 1
	});
	const floorNodeIds = new Set(result.project.graph.nodes
		.filter((node) => node.levelId === 'level-0')
		.map((node) => node.id));
	const floorEdges = result.project.graph.edges.filter((edge) =>
		floorNodeIds.has(edge.from) && floorNodeIds.has(edge.to)
	);
	const generatedNodeIds = new Set(result.project.graph.nodes
		.filter((node) => node.authoringOwnership === 'generated')
		.map((node) => node.id));
	const parent = new Map<string, string>();
	const find = (id: string): string => {
		const current = parent.get(id) ?? id;

		if (current === id) return id;
		const root = find(current);
		parent.set(id, root);

		return root;
	};
	const join = (left: string, right: string): boolean => {
		const leftRoot = find(left);
		const rightRoot = find(right);

		if (leftRoot === rightRoot) return false;
		parent.set(rightRoot, leftRoot);

		return true;
	};
	const pointInPolygon = (
		point: { x: number; y: number },
		polygon: readonly { x: number; y: number }[]
	): boolean => {
		let inside = false;

		for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
			const left = polygon[index];
			const right = polygon[previous];

			if (
				(left.y > point.y) !== (right.y > point.y)
				&& point.x < (right.x - left.x) * (point.y - left.y)
					/ (right.y - left.y) + left.x
			) inside = !inside;
		}

		return inside;
	};
	const obstacles = result.project.floors[0].elements.filter(
		(element): element is WayfindingStudioPolygonElement => element.type === 'obstacle'
	);

	assert.equal(result.connectedSemanticNodes, 12);
	assert.equal(result.totalSemanticNodes, 12);
	assert.deepEqual(result.diagnostics, []);
	assert.equal(result.diff.generatedEdgesBefore, 3);
	assert.equal(result.diff.generatedNodesBefore, 3);
	assert.equal(result.diff.manualEdgesPreserved, 1);
	assert.equal(result.diff.manualNodesPreserved, 0);
	assert.equal(result.project.floors[0].width, WAYFINDING_PROJECT_7_REFERENCE_SIZE.width);
	assert.equal(result.project.floors[0].height, WAYFINDING_PROJECT_7_REFERENCE_SIZE.height);
	assert.equal(
		result.project.graph.edges.some((edge) => edge.id.includes(':stale-edge-')),
		false
	);
	assert.ok(result.project.graph.edges.some((edge) => edge.id === 'manual-reviewed-edge'));
	assert.ok(
		Math.abs(
			(result.project.graph.nodes.find((node) => node.semanticElementId === 'north-c')?.x ?? 0)
				- 415 * WAYFINDING_PROJECT_7_REFERENCE_SIZE.width / 1_200
		) < 0.001
	);
	assert.deepEqual(
		floorEdges.flatMap((edge) => inspectRouteGeometry(edge, result.project.graph.nodes)),
		[]
	);

	for (const edge of floorEdges) {
		assert.equal(join(edge.from, edge.to), true, `${edge.id} introduced a redundant route cycle`);
		const geometry = edge.geometry ?? [];

		for (let index = 1; index < geometry.length; index += 1) {
			const start = geometry[index - 1];
			const end = geometry[index];
			const length = Math.hypot(end.x - start.x, end.y - start.y);
			const samples = Math.max(1, Math.ceil(length / 2));

			for (let sample = 1; sample < samples; sample += 1) {
				const ratio = sample / samples;
				const point = {
					x: start.x + (end.x - start.x) * ratio,
					y: start.y + (end.y - start.y) * ratio
				};

				assert.equal(
					obstacles.some((obstacle) => pointInPolygon(point, obstacle.geometry)),
					false,
					`${edge.id} crossed blocked space at ${point.x},${point.y}`
				);
			}
		}
	}
	assert.ok(generatedNodeIds.size > 0);
});

void test('keeps the complex mall network connected, deterministic, and routeable across resolution changes', () => {
	for (const cellSize of [4, 6, 8, 10]) {
		const result = buildFloorRouteNetwork(createComplexConcourseFixture(), 'level-0', {
			cellSize,
			clearanceCells: 1
		});
		const graph = new WayfindingGraph(result.project.graph);
		const routeableElementIds = new Set(result.project.floors[0].elements
			.filter((element) => ['location', 'origin', 'poi', 'transition'].includes(element.type))
			.map((element) => element.id));
		const semanticNodeIds = result.project.graph.nodes
			.filter((node) => node.semanticElementId && routeableElementIds.has(node.semanticElementId))
			.map((node) => node.id);

		assert.equal(
			result.connectedSemanticNodes,
			result.totalSemanticNodes,
			`${cellSize}px sampling disconnected a valid mall entrance`
		);
		assert.deepEqual(result.diagnostics, []);
		assert.equal(result.totalSemanticNodes, 12);

		for (const destinationNodeId of semanticNodeIds.filter((id) => id !== 'semantic:origin-west')) {
			const route = graph.route('semantic:origin-west', destinationNodeId, {
				mapRatio: result.project.floors[0].unitsPerMeter,
				profile: 'step-free'
			});

			assert.ok(route, `${destinationNodeId} was unreachable at ${cellSize}px sampling`);
			assert.equal(
				new Set(route.nodeIds).size,
				route.nodeIds.length,
				`${destinationNodeId} route repeated a node at ${cellSize}px sampling`
			);
			assert.ok(route.path.length >= 2);
		}
	}

	const first = buildFloorRouteNetwork(createComplexConcourseFixture(), 'level-0', {
		cellSize: 6,
		clearanceCells: 1
	});
	const second = buildFloorRouteNetwork(createComplexConcourseFixture(), 'level-0', {
		cellSize: 6,
		clearanceCells: 1
	});
	const generated = (result: typeof first): {
		edges: typeof result.project.graph.edges;
		nodes: typeof result.project.graph.nodes;
	} => ({
		edges: result.project.graph.edges.filter((edge) => edge.authoringOwnership === 'generated'),
		nodes: result.project.graph.nodes.filter((node) => node.authoringOwnership === 'generated')
	});

	assert.deepEqual(generated(first), generated(second));
});

void test('routes Project 9 irregular geometry without random loops, skipped entrances, or obstacle crossings', () => {
	const generatedGraphs: Array<{
		edges: ReturnType<typeof buildFloorRouteNetwork>['project']['graph']['edges'];
		nodes: ReturnType<typeof buildFloorRouteNetwork>['project']['graph']['nodes'];
	}> = [];

	for (const cellSize of [4, 6, 8, 10]) {
		const result = buildFloorRouteNetwork(
			createIrregularAtriumFixture({ includeOverlappingRoomEntrance: true }),
			'level-0',
			{ cellSize, clearanceCells: 1 }
		);
		const graph = new WayfindingGraph(result.project.graph);
		const obstacle = result.project.floors[0].elements.find(
			(element): element is WayfindingStudioPolygonElement => element.id === 'blocked-planter'
		);
		const pointInPolygon = (point: { x: number; y: number }): boolean => {
			if (!obstacle) return false;
			let inside = false;

			for (
				let index = 0, previous = obstacle.geometry.length - 1;
				index < obstacle.geometry.length;
				previous = index, index += 1
			) {
				const left = obstacle.geometry[index];
				const right = obstacle.geometry[previous];

				if (
					(left.y > point.y) !== (right.y > point.y)
					&& point.x < (right.x - left.x) * (point.y - left.y)
						/ (right.y - left.y) + left.x
				) inside = !inside;
			}

			return inside;
		};

		assert.equal(result.totalSemanticNodes, 6);
		assert.equal(result.connectedSemanticNodes, 6, `${cellSize}px sampling skipped a real entrance`);
		assert.deepEqual(result.diagnostics, []);
		assert.deepEqual(
			validateWayfindingStudioPublish(result.project).filter(
				(issue) => issue.code === 'route-leaves-walkable-space'
			),
			[],
			`${cellSize}px sampling produced a connector that cannot be published`
		);
		assert.deepEqual(
			result.project.graph.edges.flatMap((edge) =>
				inspectRouteGeometry(edge, result.project.graph.nodes)
			),
			[]
		);
		const irregularDoorConnector = result.project.graph.edges.find(
			(edge) => edge.id === 'generated:level-0:connector:semantic:room-north-a'
		);

		assert.equal(
			irregularDoorConnector?.geometry?.length,
			2,
			`${cellSize}px sampling left a redundant zigzag in the irregular doorway connector`
		);

		for (const destinationId of [
			'room-west',
			'room-north-a',
			'room-north-b',
			'room-south-a',
			'room-south-b'
		]) {
			const route = graph.route('semantic:origin-atrium', `semantic:${destinationId}`, {
				mapRatio: result.project.floors[0].unitsPerMeter,
				profile: 'step-free'
			});

			assert.ok(route, `${destinationId} was unreachable at ${cellSize}px sampling`);
			assert.equal(new Set(route.nodeIds).size, route.nodeIds.length);

			for (let index = 1; index < route.path.length; index += 1) {
				const start: { x: number; y: number } = route.path[index - 1];
				const end: { x: number; y: number } = route.path[index];
				const samples = Math.max(1, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 2));

				for (let sample = 1; sample < samples; sample += 1) {
					const ratio = sample / samples;

					assert.equal(pointInPolygon({
						x: start.x + (end.x - start.x) * ratio,
						y: start.y + (end.y - start.y) * ratio
					}), false, `${destinationId} crossed the planter at ${cellSize}px sampling`);
				}
			}
		}

		generatedGraphs.push({
			edges: result.project.graph.edges.filter((edge) => edge.authoringOwnership === 'generated'),
			nodes: result.project.graph.nodes.filter((node) => node.authoringOwnership === 'generated')
		});
	}

	const repeated = buildFloorRouteNetwork(
		createIrregularAtriumFixture({ includeOverlappingRoomEntrance: true }),
		'level-0',
		{ cellSize: 6, clearanceCells: 1 }
	);

	assert.deepEqual(generatedGraphs[1], {
		edges: repeated.project.graph.edges.filter((edge) => edge.authoringOwnership === 'generated'),
		nodes: repeated.project.graph.nodes.filter((node) => node.authoringOwnership === 'generated')
	});
});

void test('preserves the shortest useful branches for every screen in a multi-origin mall', () => {
	const project = createComplexConcourseFixture();
	project.floors[0].elements.push({
		facingDegrees: 270,
		floorId: 'level-0',
		id: 'origin-east',
		label: 'East entrance',
		point: { x: 1_110, y: 350 },
		provenance: 'reviewer-authored',
		screenId: 'screen-east',
		status: 'confirmed',
		type: 'origin'
	});
	const result = buildFloorRouteNetwork(project, 'level-0', {
		cellSize: 6,
		clearanceCells: 1
	});
	const graph = new WayfindingGraph(result.project.graph);
	const westToWest = graph.route('semantic:origin-west', 'semantic:north-a', { mapRatio: 12 });
	const eastToWest = graph.route('semantic:origin-east', 'semantic:north-a', { mapRatio: 12 });
	const westToEast = graph.route('semantic:origin-west', 'semantic:north-f', { mapRatio: 12 });
	const eastToEast = graph.route('semantic:origin-east', 'semantic:north-f', { mapRatio: 12 });

	assert.equal(result.connectedSemanticNodes, 13);
	assert.equal(result.totalSemanticNodes, 13);
	assert.deepEqual(result.diagnostics, []);
	assert.ok(westToWest);
	assert.ok(eastToWest);
	assert.ok(westToEast);
	assert.ok(eastToEast);
	assert.ok(westToWest.walkingDistance < eastToWest.walkingDistance);
	assert.ok(eastToEast.walkingDistance < westToEast.walkingDistance);
});
