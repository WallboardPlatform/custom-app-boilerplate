import assert from 'node:assert/strict';
import test from 'node:test';
import {
	appendFreehandPoint,
	simplifyFreehandPolygon
} from './freehand.ts';

void test('freehand sampling ignores pointer noise below the configured distance', () => {
	const first = appendFreehandPoint([], { x: 10, y: 10 }, 5);
	const ignored = appendFreehandPoint(first, { x: 12, y: 12 }, 5);
	const appended = appendFreehandPoint(ignored, { x: 20, y: 10 }, 5);

	assert.equal(ignored, first);
	assert.deepEqual(appended, [{ x: 10, y: 10 }, { x: 20, y: 10 }]);
});

void test('freehand polygons simplify straight runs without losing their corners', () => {
	const simplified = simplifyFreehandPolygon([
		{ x: 0, y: 0 },
		{ x: 5, y: 0.2 },
		{ x: 10, y: 0 },
		{ x: 10.1, y: 5 },
		{ x: 10, y: 10 },
		{ x: 5, y: 10.1 },
		{ x: 0, y: 10 },
		{ x: 0.1, y: 5 },
		{ x: 0, y: 0 }
	], 1);

	assert.deepEqual(simplified, [
		{ x: 0, y: 0 },
		{ x: 10, y: 0 },
		{ x: 10, y: 10 },
		{ x: 0, y: 10 }
	]);
});
