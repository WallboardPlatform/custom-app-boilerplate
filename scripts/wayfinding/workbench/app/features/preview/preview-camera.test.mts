import assert from 'node:assert/strict';
import test from 'node:test';
import {
	previewCameraInsets,
	previewCameraOffset,
	type PreviewCameraLayout
} from './preview-camera.ts';

const layout = (
	values: Partial<PreviewCameraLayout> = {}
): PreviewCameraLayout => ({
	destinationOpen: true,
	detailOnRight: false,
	preview: true,
	viewportHeight: 720,
	viewportWidth: 1_280,
	...values
});

void test('fits desktop Preview maps beside their floating directory and guidance surfaces', () => {
	assert.deepEqual(
		previewCameraInsets(layout({ destinationOpen: false, viewportWidth: 1_024 })),
		{ bottom: 0, left: 0, right: 410, top: 0 }
	);
	assert.deepEqual(
		previewCameraInsets(layout({ detailOnRight: false, viewportWidth: 1_024 })),
		{ bottom: 0, left: 420, right: 0, top: 0 }
	);
	assert.deepEqual(
		previewCameraInsets(layout({ detailOnRight: true, viewportWidth: 1_280 })),
		{ bottom: 0, left: 0, right: 420, top: 0 }
	);
	assert.deepEqual(
		previewCameraInsets(layout({ detailOnRight: true, viewportWidth: 1_920 })),
		{ bottom: 0, left: 0, right: 0, top: 0 }
	);
	assert.deepEqual(
		previewCameraInsets(layout({ detailOnRight: false, viewportWidth: 3_840 })),
		{ bottom: 0, left: 620, right: 0, top: 0 }
	);
});

void test('uses vertical zones for portrait guidance and preserves the compact landscape route', () => {
	const portrait = layout({ viewportHeight: 1_920, viewportWidth: 1_080 });

	assert.deepEqual(
		previewCameraInsets(portrait),
		{ bottom: 864, left: 0, right: 0, top: 0 }
	);
	assert.deepEqual(previewCameraOffset(portrait), { x: 0, y: 76.8 });
	assert.deepEqual(
		previewCameraInsets(layout({ viewportHeight: 480, viewportWidth: 800 })),
		{ bottom: 0, left: 0, right: 0, top: 0 }
	);
	assert.deepEqual(
		previewCameraOffset(layout({ viewportHeight: 480, viewportWidth: 800 })),
		{ x: 0, y: -64 }
	);
});

void test('does not apply Preview composition to authoring canvases', () => {
	assert.deepEqual(
		previewCameraInsets(layout({ preview: false })),
		{ bottom: 0, left: 0, right: 0, top: 0 }
	);
	assert.deepEqual(previewCameraOffset(layout({ preview: false })), { x: 0, y: 0 });
});
