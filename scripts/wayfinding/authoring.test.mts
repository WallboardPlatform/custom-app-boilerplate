import assert from 'node:assert/strict';
import test from 'node:test';

import type { WayfindingGraphDocument } from '../../src/utils/wayfinding.js';
import { addProposedEdge, addRouteNode, upsertLocationAnchor } from './authoring.mts';

const emptyGraph = (): WayfindingGraphDocument => ({ contractVersion: 2, edges: [], graphId: 'authoring-test', nodes: [] });

await test('creates and moves destination anchors while invalidating connected review', (): void => {
	const graph: WayfindingGraphDocument = emptyGraph();
	const first = upsertLocationAnchor(graph, 'lobby', { x: 10, y: 20 }, 'level-0');
	const route = addRouteNode(graph, { x: 40, y: 20 }, 'level-0');
	const edge = addProposedEdge(graph, first.id, route.id, [first, route]);
	edge.reviewStatus = 'confirmed';
	const moved = upsertLocationAnchor(graph, 'lobby', { x: 15, y: 25 }, 'level-0');

	assert.equal(moved.id, first.id);
	assert.equal(graph.nodes.length, 2);
	assert.deepEqual(edge.geometry?.[0], { x: 15, y: 25 });
	assert.equal(edge.reviewStatus, 'proposed');
});

await test('authors explicit proposed edges with stable endpoint geometry', (): void => {
	const graph: WayfindingGraphDocument = emptyGraph();
	const from = addRouteNode(graph, { x: 10, y: 10 }, 'level-0');
	const to = addRouteNode(graph, { x: 80, y: 40 }, 'level-0');
	const edge = addProposedEdge(graph, from.id, to.id, [from, { x: 40, y: 10 }, to]);

	assert.equal(graph.contractVersion, 2);
	assert.equal(edge.reviewStatus, 'proposed');
	assert.equal(edge.accessible, false);
	assert.deepEqual(edge.geometry, [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 80, y: 40 }]);
});

await test('rejects self edges instead of silently creating invalid topology', (): void => {
	const graph: WayfindingGraphDocument = emptyGraph();
	const node = addRouteNode(graph, { x: 10, y: 10 }, 'level-0');

	assert.throws((): void => { addProposedEdge(graph, node.id, node.id, [node, node]); }, /cannot connect a node to itself/);
});
