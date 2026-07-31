import assert from 'node:assert/strict';
import test from 'node:test';

import type {
	WayfindingEdge,
	WayfindingNode
} from '../../../../../../src/utils/wayfinding.ts';
import { createWayfindingStudioProject } from '../../../../studio-project.mts';
import {
	routeDisconnectedMessage,
	routeEdgeLabel,
	routeGeometryIssueMessage,
	routeNodeLabel
} from './route-labels.ts';

void test('route diagnostics use destination language instead of internal semantic IDs', () => {
	const project = createWayfindingStudioProject('Human route labels');
	const floor = project.floors[0];
	project.destinations = [{
		floor: floor.id,
		id: 'destination-library',
		name: 'Library',
		routeable: true
	}];
	floor.elements = [{
		destinationId: 'destination-library',
		floorId: floor.id,
		geometry: [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 40 }],
		id: 'room-library',
		provenance: 'customer-source',
		status: 'confirmed',
		type: 'location'
	}];
	const nodes: WayfindingNode[] = [
		{
			id: 'route-junction',
			kind: 'route',
			levelId: floor.id,
			x: 0,
			y: 0
		},
		{
			id: 'semantic:room-library',
			kind: 'location',
			levelId: floor.id,
			locationId: 'destination-library',
			semanticElementId: 'room-library',
			x: 10,
			y: 10
		}
	];
	const edge: WayfindingEdge = {
		accessible: true,
		bidirectional: true,
		from: nodes[0].id,
		geometry: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
		id: 'generated:technical-id',
		kind: 'walk',
		reviewStatus: 'proposed',
		to: nodes[1].id,
		traversal: 'portal'
	};

	assert.equal(routeNodeLabel(project, nodes[1]), 'Library');
	assert.equal(routeEdgeLabel(project, edge, nodes), 'Entrance connection to Library');
	assert.equal(
		routeDisconnectedMessage(project, nodes[1]),
		'Library is not connected. Open Build to link its entrance, or draw a connection from this endpoint.'
	);
	assert.equal(
		routeGeometryIssueMessage(
			project,
			{ code: 'backtracking', geometryIndex: 2, message: 'technical', severity: 'warning' },
			edge,
			nodes
		),
		'Entrance connection to Library doubles back near bend 2.'
	);
});
