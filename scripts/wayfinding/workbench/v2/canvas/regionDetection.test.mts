import assert from 'node:assert/strict';
import test from 'node:test';
import {
	detectFlatRegionBoundary,
	type RegionDetectionSource
} from './regionDetection.ts';

const image = (
	width: number,
	height: number,
	colorAt: (x: number, y: number) => [number, number, number]
): RegionDetectionSource => {
	const data = new Uint8ClampedArray(width * height * 4);

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const [r, g, b] = colorAt(x, y);
			const offset = (y * width + x) * 4;

			data[offset] = r;
			data[offset + 1] = g;
			data[offset + 2] = b;
			data[offset + 3] = 255;
		}
	}

	return { data, height, width };
};

void test('detects and simplifies a flat-color room', () => {
	const source = image(
		120,
		80,
		(x, y) => x >= 20 && x < 100 && y >= 15 && y < 65
			? [231, 174, 93]
			: [245, 245, 245]
	);
	const region = detectFlatRegionBoundary(source, { x: 50, y: 40 }, {
		closeGap: 2,
		colorTolerance: 8,
		detail: 5,
		minimumOpening: 5
	});

	assert.ok(region);
	assert.equal(region.color, '#e7ae5d');
	assert.ok(region.geometry.length >= 4);
	assert.ok(region.geometry.length <= 8);
	assert.ok(Math.min(...region.geometry.map(({ x }) => x)) <= 22);
	assert.ok(Math.max(...region.geometry.map(({ x }) => x)) >= 98);
});

void test('minimum opening prevents leaking through a narrow gap', () => {
	const source = image(
		160,
		90,
		(x, y) => {
			const leftRoom = x >= 10 && x < 70 && y >= 10 && y < 80;
			const rightRoom = x >= 90 && x < 150 && y >= 10 && y < 80;
			const narrowBridge = x >= 70 && x < 90 && y >= 43 && y < 47;

			return leftRoom || rightRoom || narrowBridge
				? [125, 190, 175]
				: [250, 250, 250];
		}
	);
	const region = detectFlatRegionBoundary(source, { x: 30, y: 40 }, {
		closeGap: 0,
		colorTolerance: 8,
		detail: 4,
		minimumOpening: 9
	});

	assert.ok(region);
	assert.ok(Math.max(...region.geometry.map(({ x }) => x)) < 90);
});
