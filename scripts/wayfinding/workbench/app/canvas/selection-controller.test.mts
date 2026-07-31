import assert from 'node:assert/strict';
import test from 'node:test';

import { createEditorState } from '../../../editor-core/state.ts';
import {
	createWayfindingStudioProject,
	type WayfindingStudioProject
} from '../../../studio-project.mts';
import {
	buildCanvasSelectionOperation,
	describeCanvasSelection,
	insertionSegmentIndex,
	segmentMidpoint
} from './selection-controller.ts';

const project = (): WayfindingStudioProject => ({
	...createWayfindingStudioProject('selection-test'),
	floors: [{
		elements: [{
			geometry: [
				{ x: 10, y: 10 },
				{ x: 80, y: 10 },
				{ x: 80, y: 60 },
				{ x: 10, y: 60 }
			],
			floorId: 'level-0',
			id: 'room-a',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		}],
		height: 100,
		id: 'level-0',
		name: 'Level 0',
		order: 0,
		width: 100
	}],
	graph: {
		edges: [{
			accessible: true,
			bidirectional: true,
			from: 'route-a',
			geometry: [
				{ x: 10, y: 80 },
				{ x: 50, y: 70 },
				{ x: 90, y: 80 }
			],
			id: 'edge-a-b',
			kind: 'walk',
			reviewStatus: 'confirmed',
			to: 'route-b',
			traversal: 'indoor-corridor'
		}],
		graphId: 'selection-test-graph',
		nodes: [
			{ id: 'route-a', kind: 'route', levelId: 'level-0', x: 10, y: 80 },
			{ id: 'route-b', kind: 'route', levelId: 'level-0', x: 90, y: 80 }
		]
	}
});

void test('describes polygon editing without duplicating toolbar rules', (): void => {
	const state = createEditorState(project());
	state.selection = { id: 'room-a', kind: 'element', vertexIndex: 1 };
	const descriptor = describeCanvasSelection(state);

	assert.equal(descriptor?.kind, 'polygon');
	assert.equal(descriptor?.pointKind, 'vertex');
	assert.equal(descriptor?.pointCount, 4);
	assert.equal(descriptor?.canDuplicate, true);
	assert.equal(descriptor?.canRemovePoint, true);
	assert.equal(descriptor?.canStraighten, false);
});

void test('describes route segment repair and bend editing from graph state', (): void => {
	const state = createEditorState(project());
	state.selection = { geometryIndex: 1, id: 'edge-a-b', kind: 'graph-edge' };
	const descriptor = describeCanvasSelection(state);

	assert.equal(descriptor?.kind, 'route-segment');
	assert.equal(descriptor?.pointKind, 'bend');
	assert.equal(descriptor?.pointCount, 3);
	assert.equal(descriptor?.canRemovePoint, true);
	assert.equal(descriptor?.canRepair, true);
	assert.equal(descriptor?.canStraighten, true);
});

void test('protects route endpoints from point removal', (): void => {
	const state = createEditorState(project());
	state.selection = { geometryIndex: 0, id: 'edge-a-b', kind: 'graph-edge' };

	assert.equal(describeCanvasSelection(state)?.canRemovePoint, false);
	assert.equal(buildCanvasSelectionOperation(state, { type: 'remove-point' }), undefined);

	state.selection = { geometryIndex: 2, id: 'edge-a-b', kind: 'graph-edge' };
	assert.equal(describeCanvasSelection(state)?.canRemovePoint, false);
	assert.equal(buildCanvasSelectionOperation(state, { type: 'remove-point' }), undefined);
});

void test('inserts a point on the selected or longest segment', (): void => {
	const geometry = [
		{ x: 0, y: 0 },
		{ x: 20, y: 0 },
		{ x: 20, y: 5 },
		{ x: 0, y: 5 }
	];

	assert.equal(insertionSegmentIndex(geometry, 2, true), 2);
	assert.equal(insertionSegmentIndex(geometry, undefined, true), 0);
	assert.deepEqual(segmentMidpoint(geometry, 0, true), { x: 10, y: 0 });
});

void test('does not insert an open route bend after its final point', (): void => {
	const geometry = [
		{ x: 0, y: 0 },
		{ x: 5, y: 0 },
		{ x: 25, y: 0 }
	];

	assert.equal(insertionSegmentIndex(geometry, 2, false), 1);
	assert.equal(insertionSegmentIndex(geometry, undefined, false), 1);
	assert.deepEqual(segmentMidpoint(geometry, 1, false), { x: 15, y: 0 });
});

void test('builds one undoable transaction for polygon point editing', (): void => {
	const state = createEditorState(project());
	state.selection = { id: 'room-a', kind: 'element', vertexIndex: 1 };
	const addResult = buildCanvasSelectionOperation(state, { type: 'add-point' });

	assert.equal(addResult?.transaction.label, 'Add shape point');
	assert.equal(addResult?.transaction.commands.length, 1);
	assert.deepEqual(addResult?.selection, {
		id: 'room-a',
		kind: 'element',
		vertexIndex: 2
	});
	const patch = addResult?.transaction.commands[0];

	assert.equal(patch?.type, 'element/patch');
	assert.equal(
		patch?.type === 'element/patch' && 'geometry' in patch.patch
			? patch.patch.geometry?.length
			: undefined,
		5
	);
});

void test('repairs and straightens route geometry through the shared command path', (): void => {
	const state = createEditorState(project());
	state.selection = { id: 'edge-a-b', kind: 'graph-edge' };
	const repairResult = buildCanvasSelectionOperation(state, { type: 'repair' });
	const straightenResult = buildCanvasSelectionOperation(state, { type: 'straighten' });

	assert.equal(repairResult?.transaction.label, 'Repair route segment');
	assert.equal(repairResult?.selection?.kind, 'graph-edge');
	assert.equal(straightenResult?.transaction.label, 'Straighten route segment');
	const command = straightenResult?.transaction.commands[0];

	assert.deepEqual(
		command?.type === 'graph/edge-patch' ? command.patch.geometry : undefined,
		[{ x: 10, y: 80 }, { x: 90, y: 80 }]
	);
});

void test('deleting a destination also removes its linked map element', (): void => {
	const source = project();
	source.destinations = [{
		floorId: 'level-0',
		id: 'destination-a',
		name: 'Room A'
	}];
	const room = source.floors[0].elements[0];

	assert.equal(room.type, 'location');

	if (room.type !== 'location') throw new Error('Expected the room fixture.');
	source.floors[0].elements[0] = {
		...room,
		destinationId: 'destination-a'
	};
	const state = createEditorState(source);
	state.selection = { id: 'destination-a', kind: 'destination' };
	const deleteResult = buildCanvasSelectionOperation(state, { type: 'delete' });

	assert.deepEqual(
		deleteResult?.transaction.commands.map((command) => command.type),
		['element/remove', 'destination/remove']
	);
});
