import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createWayfindingStudioProject,
	synchronizeWayfindingStudioGraph,
	type WayfindingStudioFloor,
	type WayfindingStudioProject
} from '../studio-project.mts';
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
			angle: 0,
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
			angle: 0,
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
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6 });
	const originNode = result.project.graph.nodes.find((node) => node.semanticElementId === 'origin-main');
	const doorNode = result.project.graph.nodes.find((node) => node.semanticElementId === 'door-room-a');

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

void test('builds routes from an imported painted pedestrian mask', () => {
	const project = createWayfindingStudioProject('Painted mask route test');
	const floor = project.floors[0];
	floor.width = 320;
	floor.height = 180;
	floor.unitsPerMeter = 10;
	floor.pedestrianSpaceSource = 'mask';
	floor.walkableMask = {
		cellSize: 5,
		columns: 64,
		contractVersion: 1,
		height: 180,
		mapId: floor.id,
		reviewStatus: 'confirmed',
		rows: 36,
		walkableRuns: Array.from(
			{ length: 20 },
			(_, index): [number, number, number] => [index + 8, 4, 59]
		),
		width: 320
	};
	floor.elements.push(
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
			angle: 0,
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
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id);

	assert.ok(result.nodes > 0);
	assert.ok(result.edges > 0);
	assert.equal(result.connectedSemanticNodes, result.totalSemanticNodes);
	assert.deepEqual(result.diagnostics, []);
});

void test('reports doorway connectors that require a generic point fallback', () => {
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

	assert.equal(result.connectedSemanticNodes, result.totalSemanticNodes);
	assert.equal(result.diagnostics.length, 1);
	assert.deepEqual(result.diagnostics[0], {
		code: 'connector-fallback',
		elementId: 'door-detached',
		message: 'door-detached was connected without using its doorway direction. Review this entrance.',
		nodeId: result.project.graph.nodes.find((node) => node.semanticElementId === 'door-detached')?.id,
		severity: 'warning'
	});
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
			angle: 0,
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
	synchronizeWayfindingStudioGraph(project);

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6, clearanceCells: 1 });
	const doorNode = result.project.graph.nodes.find((node) => node.semanticElementId === 'door-north');
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
		to: 'manual-node-b'
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
		to: 'generated:level-1:node:2'
	});
	const expectedUpperNodes = structuredClone(project.graph.nodes.filter((node) => node.levelId === upperFloor.id));
	const expectedUpperEdges = structuredClone(project.graph.edges.filter((edge) => edge.id.startsWith('generated:level-1:')));

	const result = buildFloorRouteNetwork(project, floor.id, { cellSize: 6 });

	assert.deepEqual(result.project.graph.nodes.filter((node) => node.levelId === upperFloor.id), expectedUpperNodes);
	assert.deepEqual(result.project.graph.edges.filter((edge) => edge.id.startsWith('generated:level-1:')), expectedUpperEdges);
});
