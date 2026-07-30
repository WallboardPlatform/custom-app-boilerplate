import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createWayfindingStudioProject,
	wayfindingStudioProjectDefaults
} from '../studio-project.mts';
import {
	buildPointAuthoring,
	buildPolygonAuthoring,
	buildRouteEdgeAuthoring,
	type AuthoringIdFactory
} from '../workbench/v2/canvas/authoring.ts';

const deterministicIds = (): AuthoringIdFactory => {
	const counts = new Map<string, number>();

	return (prefix: string): string => {
		const count = (counts.get(prefix) ?? 0) + 1;
		counts.set(prefix, count);

		return `${prefix}-${count}`;
	};
};

void test('location authoring creates its destination and geometry in one transaction', (): void => {
	const project = createWayfindingStudioProject('location-authoring');
	const result = buildPolygonAuthoring({
		createId: deterministicIds(),
		defaults: wayfindingStudioProjectDefaults(project),
		elementType: 'location',
		floorId: 'level-0',
		geometry: [{ x: 10, y: 10 }, { x: 80, y: 10 }, { x: 80, y: 60 }, { x: 10, y: 60 }],
		inheritedColor: '#4b7f6a',
		project
	});

	assert.equal(result.transaction.label, 'Create Location 1');
	assert.equal(result.transaction.commands.length, 2);
	assert.equal(result.transaction.commands[0].type, 'destination/add');
	assert.equal(result.transaction.commands[1].type, 'element/add');
	assert.deepEqual(result.selection, { id: 'location-1', kind: 'element' });

	const elementCommand = result.transaction.commands[1];
	assert.equal(elementCommand.type, 'element/add');

	if (elementCommand.type !== 'element/add') return;
	assert.equal(elementCommand.element.type, 'location');

	if (elementCommand.element.type !== 'location') return;
	assert.equal(elementCommand.element.destinationId, 'destination-1');
	assert.equal(elementCommand.element.presentation?.fillColor, '#4b7f6a');
});

void test('media authoring keeps the source aspect ratio and links the selected destination', (): void => {
	const result = buildPointAuthoring({
		activeAsset: {
			dataUrl: 'data:image/png;base64,AA==',
			id: 'brand-mark',
			kind: 'logo',
			mimeType: 'image/png',
			name: 'Brand mark',
			naturalHeight: 200,
			naturalWidth: 400
		},
		createId: deterministicIds(),
		defaults: wayfindingStudioProjectDefaults(createWayfindingStudioProject('media-authoring')),
		destinationCount: 2,
		floorId: 'level-0',
		point: { x: 240, y: 180 },
		selectedDestinationId: 'destination-2',
		tool: 'logo'
	});

	assert.ok(result);
	assert.equal(result.element.type, 'logo');

	if (result.element.type !== 'logo') return;
	assert.equal(result.element.width / result.element.height, 2);
	assert.equal(result.element.destinationId, 'destination-2');
	assert.equal(result.transaction.commands.length, 1);
});

void test('route authoring snaps endpoints and only creates missing nodes', (): void => {
	const result = buildRouteEdgeAuthoring({
		cameraScale: 2,
		createId: deterministicIds(),
		floorId: 'level-0',
		nodes: [{ id: 'existing-node', kind: 'route', levelId: 'level-0', x: 12, y: 12 }],
		points: [{ x: 10, y: 10 }, { x: 80, y: 24 }, { x: 120, y: 40 }]
	});

	assert.ok(result);
	assert.equal(result.transaction.commands.length, 2);
	assert.equal(result.transaction.commands[0].type, 'graph/node-add');
	assert.equal(result.transaction.commands[1].type, 'graph/edge-add');

	const edgeCommand = result.transaction.commands[1];
	assert.equal(edgeCommand.type, 'graph/edge-add');

	if (edgeCommand.type !== 'graph/edge-add') return;
	assert.equal(edgeCommand.edge.from, 'existing-node');
	assert.equal(edgeCommand.edge.to, 'route-node-1');
	assert.ok(edgeCommand.edge.geometry);
	assert.deepEqual(edgeCommand.edge.geometry?.[0], { x: 12, y: 12 });
	assert.deepEqual(edgeCommand.edge.geometry?.at(-1), { x: 120, y: 40 });
});
