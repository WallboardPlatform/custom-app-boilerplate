import assert from 'node:assert/strict';
import test from 'node:test';
import type {
	WayfindingEdge,
	WayfindingNode
} from '../../../../../src/utils/wayfinding.js';
import {
	constrainPointToAngle,
	insertGeometryPoint,
	moveGraphNodeTransaction,
	nearestSegment,
	pointerMoved,
	removeGeometryPoint,
	simplifyPolygonGeometry,
	translateGeometry
} from './editing.ts';

void test('constrains authored geometry to predictable 45 degree increments', (): void => {
	const horizontal = constrainPointToAngle({ x: 10, y: 10 }, { x: 93, y: 24 });
	const diagonal = constrainPointToAngle({ x: 10, y: 10 }, { x: 65, y: 71 });

	assert.ok(Math.abs(horizontal.y - 10) < 0.0001);
	assert.ok(Math.abs(diagonal.x - diagonal.y) < 0.0001);
	assert.ok(Math.abs(Math.hypot(83, 14) - Math.hypot(horizontal.x - 10, horizontal.y - 10)) < 0.0001);
});

void test('requires a visible pointer movement before geometry starts dragging', (): void => {
	assert.equal(pointerMoved({ x: 20, y: 20 }, { x: 21, y: 21 }, 1), false);
	assert.equal(pointerMoved({ x: 20, y: 20 }, { x: 22, y: 22 }, 2), true);
});

void test('translates either one polygon vertex or the complete polygon within bounds', (): void => {
	const geometry = [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 40 }];

	assert.deepEqual(
		translateGeometry(geometry, { x: 10, y: 10 }, { x: 15, y: 12 }, 100, 100, 1),
		[{ x: 10, y: 10 }, { x: 45, y: 12 }, { x: 40, y: 40 }]
	);
	assert.deepEqual(
		translateGeometry(geometry, { x: 10, y: 10 }, { x: 5, y: 5 }, 100, 100),
		[{ x: 5, y: 5 }, { x: 35, y: 5 }, { x: 35, y: 35 }]
	);
});

void test('finds, inserts, and removes geometry points consistently for polygons and routes', (): void => {
	const geometry = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];
	const segment = nearestSegment(geometry, { x: 52, y: 4 }, false);

	assert.equal(segment?.index, 0);
	assert.ok((segment?.distance ?? 100) < 5);
	const inserted = insertGeometryPoint(geometry, segment.index, { x: 52, y: 4 });
	assert.deepEqual(inserted[1], { x: 52, y: 4 });
	assert.deepEqual(removeGeometryPoint(inserted, 1, 2), geometry);
	assert.equal(removeGeometryPoint(geometry, 1, 3), undefined);
});

void test('moving a route node updates every attached edge endpoint in one transaction', (): void => {
	const nodes: WayfindingNode[] = [
		{ id: 'a', kind: 'route', levelId: 'level-0', x: 10, y: 10 },
		{ id: 'b', kind: 'route', levelId: 'level-0', x: 100, y: 10 },
		{ id: 'c', kind: 'route', levelId: 'level-0', x: 10, y: 100 }
	];
	const edges: WayfindingEdge[] = [
		{
			accessible: true,
			bidirectional: true,
			from: 'a',
			geometry: [{ x: 10, y: 10 }, { x: 60, y: 20 }, { x: 100, y: 10 }],
			id: 'a-b',
			kind: 'walk',
			to: 'b'
		},
		{
			accessible: true,
			bidirectional: true,
			from: 'c',
			id: 'c-a',
			kind: 'walk',
			to: 'a'
		}
	];
	const transaction = moveGraphNodeTransaction('a', { x: 25, y: 30 }, nodes, edges);

	assert.equal(transaction.commands.length, 3);
	assert.deepEqual(transaction.commands[1], {
		type: 'graph/edge-patch',
		edgeId: 'a-b',
		patch: { geometry: [{ x: 25, y: 30 }, { x: 60, y: 20 }, { x: 100, y: 10 }] }
	});
	assert.deepEqual(transaction.commands[2], {
		type: 'graph/edge-patch',
		edgeId: 'c-a',
		patch: { geometry: [{ x: 10, y: 100 }, { x: 25, y: 30 }] }
	});
});

void test('simplifies noisy polygon edges without collapsing the shape', (): void => {
	const geometry = [
		{ x: 0, y: 0 },
		{ x: 0.2, y: 0.1 },
		{ x: 50, y: 0 },
		{ x: 100, y: 0.1 },
		{ x: 100, y: 100 },
		{ x: 0, y: 100 }
	];

	assert.deepEqual(simplifyPolygonGeometry(geometry), [
		{ x: 0, y: 0 },
		{ x: 100, y: 0.1 },
		{ x: 100, y: 100 },
		{ x: 0, y: 100 }
	]);
	assert.equal(simplifyPolygonGeometry(geometry).length >= 3, true);
});
