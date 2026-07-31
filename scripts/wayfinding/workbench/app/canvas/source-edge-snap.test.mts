import assert from 'node:assert/strict';
import test from 'node:test';

import { snapPointToSourceEdge } from './source-edge-snap.ts';

const sourceWithVerticalEdge = (): {
	data: Uint8ClampedArray;
	height: number;
	width: number;
} => {
	const width = 40;
	const height = 30;
	const data = new Uint8ClampedArray(width * height * 4);

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = (y * width + x) * 4;
			const value = x < 20 ? 245 : 25;

			data[index] = value;
			data[index + 1] = value;
			data[index + 2] = value;
			data[index + 3] = 255;
		}
	}

	return { data, height, width };
};

void test('snaps a nearby map point to the strongest source-image edge', (): void => {
	const point = snapPointToSourceEdge({
		mapHeight: 300,
		mapWidth: 400,
		point: { x: 165, y: 140 },
		radius: 8,
		source: sourceWithVerticalEdge()
	});

	assert.ok(Math.abs(point.x - 200) <= 10);
	assert.equal(point.y, 140);
});

void test('leaves a point unchanged when snapping is disabled', (): void => {
	const original = { x: 165, y: 140 };
	const point = snapPointToSourceEdge({
		mapHeight: 300,
		mapWidth: 400,
		point: original,
		radius: 0,
		source: sourceWithVerticalEdge()
	});

	assert.deepEqual(point, original);
});
