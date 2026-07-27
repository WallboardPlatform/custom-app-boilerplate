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
