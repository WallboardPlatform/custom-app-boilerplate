import assert from 'node:assert/strict';
import test from 'node:test';

import {
	isCanvasElementInteractive,
	isRouteGraphInteractive,
	isRouteToolAvailable
} from './route-workspace.ts';

void test('map authoring keeps pedestrian geometry behind foreground objects', () => {
	assert.equal(isCanvasElementInteractive('map', 'space', 'door'), true);
	assert.equal(isCanvasElementInteractive('map', 'edit', 'location'), true);
	assert.equal(isCanvasElementInteractive('map', 'space', 'walkable'), false);
	assert.equal(isCanvasElementInteractive('map', 'space', 'obstacle'), false);
});

void test('pedestrian-space authoring only exposes walkable and blocked polygons', () => {
	assert.equal(isCanvasElementInteractive('route-edit', 'space', 'walkable'), true);
	assert.equal(isCanvasElementInteractive('route-edit', 'space', 'obstacle'), true);
	assert.equal(isCanvasElementInteractive('route-edit', 'space', 'door'), false);
	assert.equal(isCanvasElementInteractive('route-edit', 'space', 'location'), false);
});

void test('network editing exposes graph geometry without semantic map hit targets', () => {
	assert.equal(isRouteGraphInteractive('route-edit', 'edit'), true);
	assert.equal(isCanvasElementInteractive('route-edit', 'edit', 'walkable'), false);
	assert.equal(isCanvasElementInteractive('route-edit', 'edit', 'door'), false);
	assert.equal(isRouteGraphInteractive('route-edit', 'space'), false);
	assert.equal(isRouteGraphInteractive('map', 'edit'), false);
});

void test('each route tab only exposes tools that can act in that interaction mode', () => {
	assert.equal(isRouteToolAvailable('space', 'walkable'), true);
	assert.equal(isRouteToolAvailable('space', 'route-edge'), false);
	assert.equal(isRouteToolAvailable('edit', 'route-edge'), true);
	assert.equal(isRouteToolAvailable('edit', 'walkable'), false);
	assert.equal(isRouteToolAvailable('build', 'pan'), true);
	assert.equal(isRouteToolAvailable('build', 'select'), false);
	assert.equal(isRouteToolAvailable('test', 'route-node'), false);
});
