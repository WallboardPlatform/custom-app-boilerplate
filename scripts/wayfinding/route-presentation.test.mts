import assert from 'node:assert/strict';
import test from 'node:test';

import {
	presentRoutePoints,
	routeLength,
	routePositionAt,
	routeSegmentWithinMask,
	routeSvgPath,
	shortcutRoutePoints
} from '../../src/utils/wayfinding-route-presentation.js';
import type { WayfindingPoint } from '../../src/utils/wayfinding.js';

void test('rounds safe corners without discarding the complete route when one corner is blocked', () => {
	const source: WayfindingPoint[] = [
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 100 },
		{ x: 200, y: 100 },
		{ x: 200, y: 200 }
	];
	const result: WayfindingPoint[] = presentRoutePoints(
		source,
		40,
		(left: WayfindingPoint, right: WayfindingPoint): boolean => Math.max(left.x, right.x) <= 160
	);

	assert.ok(result.length > source.length);
	assert.ok(result.some((point: WayfindingPoint): boolean => point.x > 60 && point.x < 100 && point.y > 0 && point.y < 40));
	assert.ok(result.some((point: WayfindingPoint): boolean => point.x === 200 && point.y === 100));
	assert.deepEqual(result[0], source[0]);
	assert.deepEqual(result.at(-1), source.at(-1));
});

void test('samples route motion from start toward destination', () => {
	const points: WayfindingPoint[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

	assert.equal(routeLength(points), 200);
	assert.deepEqual(routePositionAt(points, 50), { angle: 0, point: { x: 50, y: 0 } });
	const finalSegment = routePositionAt(points, 150);
	assert.ok(finalSegment);
	assert.equal(finalSegment.point.x, 100);
	assert.equal(finalSegment.point.y, 50);
	assert.equal(Number(finalSegment.angle.toFixed(3)), Number((Math.PI / 2).toFixed(3)));
	assert.equal(routeSvgPath(points), 'M 0 0 L 100 0 L 100 100');
});

void test('removes skeleton detours when a verified direct segment is available', () => {
	const points: WayfindingPoint[] = [
		{ x: 0, y: 0 },
		{ x: 30, y: 0 },
		{ x: 20, y: 30 },
		{ x: 60, y: 30 },
		{ x: 80, y: 0 }
	];
	const result: WayfindingPoint[] = shortcutRoutePoints(points, (left, right): boolean => {
		if (left.x === 0 && right.x > 60) return false;

		return true;
	});

	assert.deepEqual(result, [{ x: 0, y: 0 }, { x: 60, y: 30 }, { x: 80, y: 0 }]);
});

void test('uses a reviewed mask to reject shortcuts through blocked space', () => {
	const mask = {
		cellSize: 10,
		columns: 10,
		contractVersion: 1 as const,
		height: 100,
		mapId: 'test-map',
		reviewStatus: 'confirmed' as const,
		rows: 10,
		walkableRuns: [[4, 0, 9], [5, 0, 9]] as Array<[number, number, number]>,
		width: 100
	};

	assert.equal(routeSegmentWithinMask(mask, { x: 0, y: 50 }, { x: 100, y: 50 }), true);
	assert.equal(routeSegmentWithinMask(mask, { x: 0, y: 50 }, { x: 100, y: 10 }), false);
});
