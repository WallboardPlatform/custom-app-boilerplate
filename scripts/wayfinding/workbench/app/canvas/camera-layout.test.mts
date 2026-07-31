import assert from 'node:assert/strict';
import test from 'node:test';

import {
	calculateCameraInsets,
	type CameraLayoutRect,
	type CameraOverlay
} from './camera-layout.ts';

const rect = (
	left: number,
	top: number,
	right: number,
	bottom: number
): CameraLayoutRect => ({ bottom, left, right, top });

void test('reserves the furthest visible overlay on every canvas edge', () => {
	const overlays: CameraOverlay[] = [
		{ edge: 'left', rect: rect(10, 10, 362, 710), visible: true },
		{ edge: 'left', rect: rect(374, 70, 414, 548), visible: true },
		{ edge: 'right', rect: rect(980, 72, 1_012, 114), visible: true },
		{ edge: 'top', rect: rect(408, 72, 616, 116), visible: true },
		{ edge: 'bottom', rect: rect(390, 628, 634, 670), visible: true }
	];

	assert.deepEqual(
		calculateCameraInsets(rect(0, 60, 1_024, 688), overlays),
		{ bottom: 72, left: 426, right: 56, top: 68 }
	);
});

void test('ignores hidden and off-canvas overlays', () => {
	const overlays: CameraOverlay[] = [
		{ edge: 'left', rect: rect(-400, 10, -20, 700), visible: true },
		{ edge: 'right', rect: rect(900, 10, 1_020, 700), visible: false },
		{ edge: 'top', rect: rect(200, -80, 400, -10), visible: true }
	];

	assert.deepEqual(
		calculateCameraInsets(rect(0, 0, 1_024, 720), overlays),
		{ bottom: 0, left: 0, right: 0, top: 0 }
	);
});
