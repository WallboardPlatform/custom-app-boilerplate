import assert from 'node:assert/strict';
import test from 'node:test';

import { fitCamera } from './geometry.ts';

void test('fits a widescreen floor map without wasting compact display space on fixed padding', () => {
	const camera = fitCamera(
		{ height: 388, width: 800 },
		{ height: 1080, width: 1920 }
	);

	assert.ok(camera.scale > 0.3);
	assert.ok(camera.offsetX >= 0);
	assert.ok(camera.offsetY >= 0);
	assert.equal(camera.offsetX, (800 - 1920 * camera.scale) / 2);
	assert.equal(camera.offsetY, (388 - 1080 * camera.scale) / 2);
});

void test('keeps a deliberate maximum breathing margin on large displays', () => {
	const camera = fitCamera(
		{ height: 2048, width: 3840 },
		{ height: 1080, width: 1920 }
	);

	assert.equal(camera.scale, (2048 - 128) / 1080);
});
