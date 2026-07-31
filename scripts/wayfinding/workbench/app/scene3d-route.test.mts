import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import {
	createRoundedRouteCurve,
	positionRouteFlowMarker
} from '../scene3d-route.mts';

const ROUTE_AXIS_FOR_TEST = new THREE.Vector3(0, 1, 0);

void test('rounds visual corners without changing route endpoints or overshooting the logical bounds', () => {
	const points = [
		new THREE.Vector3(0, 2, 0),
		new THREE.Vector3(100, 2, 0),
		new THREE.Vector3(100, 2, 80),
		new THREE.Vector3(180, 2, 80)
	];
	const curve = createRoundedRouteCurve(points, 18);

	assert.ok(curve.curves.some((part) => part instanceof THREE.QuadraticBezierCurve3));
	assert.ok(curve.getPointAt(0).distanceTo(points[0]) < 0.000_001);
	assert.ok(curve.getPointAt(1).distanceTo(points.at(-1)!) < 0.000_001);

	for (let index = 0; index <= 100; index += 1) {
		const point = curve.getPointAt(index / 100);

		assert.ok(point.x >= -0.000_001 && point.x <= 180.000_001);
		assert.ok(point.z >= -0.000_001 && point.z <= 80.000_001);
		assert.ok(Math.abs(point.y - 2) < 0.000_001);
	}
});

void test('keeps straight routes straight instead of adding redundant visual bends', () => {
	const curve = createRoundedRouteCurve([
		new THREE.Vector3(0, 1, 0),
		new THREE.Vector3(50, 1, 0),
		new THREE.Vector3(100, 1, 0)
	], 16);

	assert.equal(curve.curves.length, 1);
	assert.ok(curve.curves[0] instanceof THREE.LineCurve3);
});

void test('positions and orients a flow capsule along the route tangent', () => {
	const curve = createRoundedRouteCurve([
		new THREE.Vector3(0, 0, 0),
		new THREE.Vector3(100, 0, 0)
	], 12);
	const marker = new THREE.Object3D();

	positionRouteFlowMarker(marker, curve, 0.4);
	assert.ok(marker.position.distanceTo(new THREE.Vector3(40, 0, 0)) < 0.000_001);
	const markerAxis = ROUTE_AXIS_FOR_TEST.clone().applyQuaternion(marker.quaternion);
	assert.ok(markerAxis.distanceTo(new THREE.Vector3(1, 0, 0)) < 0.000_001);
});
