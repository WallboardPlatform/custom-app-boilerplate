import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createWayfindingStudioProject,
	synchronizeWayfindingStudioGraph
} from '../studio-project.mts';
import { buildFloorRouteNetwork } from './route-builder.mts';

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
