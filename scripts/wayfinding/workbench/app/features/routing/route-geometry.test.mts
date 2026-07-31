import assert from 'node:assert/strict';
import test from 'node:test';

import type { WayfindingEdge, WayfindingNode } from '../../../../../../src/utils/wayfinding.ts';
import {
	inspectRouteGeometry,
	measureRouteGeometry,
	measureRouteNetwork,
	repairRouteGeometry,
	straightenRouteGeometry
} from './route-geometry.ts';

const nodes: WayfindingNode[] = [
	{ id: 'a', kind: 'route', levelId: 'level-0', x: 0, y: 0 },
	{ id: 'b', kind: 'route', levelId: 'level-0', x: 100, y: 0 }
];

const edge = (geometry: WayfindingEdge['geometry']): WayfindingEdge => ({
	accessible: true,
	bidirectional: true,
	from: 'a',
	geometry,
	id: 'edge-a-b',
	kind: 'walk',
	reviewStatus: 'confirmed',
	to: 'b',
	traversal: 'indoor-corridor'
});

void test('route diagnostics localize endpoint, overlap, and backtracking defects', (): void => {
	const issues = inspectRouteGeometry(edge([
		{ x: 5, y: 0 },
		{ x: 60, y: 0 },
		{ x: 60, y: 0 },
		{ x: 30, y: 0 },
		{ x: 95, y: 0 }
	]), nodes);

	assert.deepEqual(
		new Set(issues.map((issue) => issue.code)),
		new Set(['unsnapped-endpoint', 'zero-length-segment', 'backtracking'])
	);
	assert.ok(issues.every((issue) => issue.message.includes('edge-a-b')));
});

void test('route repair orients geometry, snaps endpoints, and removes local spikes', (): void => {
	const repaired = repairRouteGeometry(edge([
		{ x: 102, y: 0 },
		{ x: 70, y: 0 },
		{ x: 70, y: 0 },
		{ x: 35, y: 0 },
		{ x: 55, y: 0 },
		{ x: -2, y: 0 }
	]), nodes);

	assert.deepEqual(repaired, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
	assert.deepEqual(inspectRouteGeometry({ ...edge(repaired), geometry: repaired }, nodes), []);
});

void test('straightening is explicit and uses the connected node positions', (): void => {
	assert.deepEqual(straightenRouteGeometry(edge([
		{ x: 0, y: 0 },
		{ x: 50, y: 40 },
		{ x: 100, y: 0 }
	]), nodes), [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
});

void test('missing graph endpoints block automatic repair', (): void => {
	const missing = { ...edge([{ x: 0, y: 0 }, { x: 100, y: 0 }]), to: 'missing' };

	assert.equal(repairRouteGeometry(missing, nodes), undefined);
	assert.equal(inspectRouteGeometry(missing, nodes)[0]?.code, 'missing-endpoint');
});

void test('route diagnostics detect short alternating jogs without penalizing normal corners', (): void => {
	const jog = edge([
		{ x: 0, y: 0 },
		{ x: 40, y: 0 },
		{ x: 43, y: 3 },
		{ x: 100, y: 3 },
		{ x: 100, y: 0 }
	]);
	const corner = edge([
		{ x: 0, y: 0 },
		{ x: 50, y: 0 },
		{ x: 100, y: 0 }
	]);

	assert.ok(inspectRouteGeometry(jog, nodes).some((issue) => issue.code === 'short-zigzag'));
	assert.equal(inspectRouteGeometry(corner, nodes).some((issue) => issue.code === 'short-zigzag'), false);
	assert.ok(measureRouteGeometry(jog, nodes).score < measureRouteGeometry(corner, nodes).score);
});

void test('network quality is length-weighted and exposes aggregate bends', (): void => {
	const straight = edge([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
	const defective = {
		...edge([
			{ x: 0, y: 0 },
			{ x: 40, y: 0 },
			{ x: 43, y: 3 },
			{ x: 100, y: 3 },
			{ x: 100, y: 0 }
		]),
		id: 'defective'
	};
	const quality = measureRouteNetwork([straight, defective], nodes);

	assert.equal(quality.bendCount, 3);
	assert.ok(quality.length > 200);
	assert.ok(quality.score > 70 && quality.score < 100);
});
