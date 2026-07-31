import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import {
	createOriginMarker3d,
	updateOriginMarker3d
} from '../scene3d-markers.mts';

void test('builds an upright selectable origin pin with a separate ground beacon', () => {
	const marker = createOriginMarker3d('#138b75', 'origin-main', 24);

	assert.equal(marker.body.userData.elementId, 'origin-main');
	assert.equal(marker.body.userData.selectionPulse, true);
	assert.equal(marker.body.geometry.type, 'ExtrudeGeometry');
	assert.equal(marker.halo.geometry.type, 'RingGeometry');
	assert.equal(marker.billboard.parent, marker.root);
	assert.equal(marker.halo.parent, marker.root);
});

void test('keeps the origin pin camera-facing while preserving its exact ground anchor', () => {
	const marker = createOriginMarker3d('#138b75', 'origin-main', 24);
	const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 10_000);
	marker.root.position.set(0, 18, 0);
	camera.position.set(0, 600, 800);

	updateOriginMarker3d(marker, camera, 'none', 0, false, 900);
	assert.equal(marker.root.position.y, 18);
	assert.ok(Math.abs(marker.billboard.rotation.y) < 0.000_001);

	camera.position.set(800, 600, 0);
	updateOriginMarker3d(marker, camera, 'none', 0, false, 900);
	assert.ok(Math.abs(marker.billboard.rotation.y - Math.PI / 2) < 0.000_001);
	assert.ok(marker.billboard.scale.y > marker.billboard.scale.x);
	assert.equal(marker.root.position.y, 18);
});

void test('animates the floating pin and ground beacon independently with a reduced-motion fallback', () => {
	const marker = createOriginMarker3d('#138b75', 'origin-main', 24);
	const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 10_000);
	camera.position.set(0, 600, 800);

	updateOriginMarker3d(marker, camera, 'bounce', 0, false, 900);
	const restingHaloScale = marker.halo.scale.x;
	updateOriginMarker3d(marker, camera, 'bounce', Math.PI / 2, false, 900);
	assert.ok(marker.billboard.position.y > 0);
	assert.ok(marker.halo.scale.x < restingHaloScale);

	updateOriginMarker3d(marker, camera, 'pulse', -Math.PI / 2, false, 900);
	const quietScale = marker.billboard.scale.x;
	const quietHaloOpacity = marker.halo.material.opacity;
	updateOriginMarker3d(marker, camera, 'pulse', Math.PI / 2, false, 900);
	assert.ok(marker.billboard.scale.x > quietScale);
	assert.ok(marker.halo.material.opacity < quietHaloOpacity);

	updateOriginMarker3d(marker, camera, 'bounce', Math.PI / 2, true, 900);
	assert.equal(marker.billboard.position.y, 0);
	assert.equal(marker.halo.scale.x, 1);
	assert.equal(marker.halo.material.opacity, 0.48);
});
