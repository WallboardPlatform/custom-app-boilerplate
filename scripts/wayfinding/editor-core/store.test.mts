import assert from 'node:assert/strict';
import test from 'node:test';

import { createWayfindingStudioProject } from '../studio-project.mts';
import { createEditorState } from './state.ts';
import { createEditorStore } from './store.ts';
import type { EditorCamera2d } from './types.ts';

void test('project commands are undoable without rewinding viewport state', (): void => {
	const store = createEditorStore(createEditorState(createWayfindingStudioProject('history-test')));
	store.dispatch({ type: 'camera/set', floorId: 'level-0', camera: { offsetX: 120, offsetY: 42, scale: 1.8 } });
	store.dispatch({ type: 'project/name', name: 'Updated map' });
	store.dispatch({ type: 'camera/set', floorId: 'level-0', camera: { offsetX: 220, offsetY: 84, scale: 2.2 } });

	store.undo();
	const snapshot = store.getSnapshot();
	assert.equal(snapshot.state.project.name, 'Wayfinding project');
	assert.deepEqual(snapshot.state.camera2dByFloor['level-0'], { offsetX: 220, offsetY: 84, scale: 2.2 });
	assert.equal(snapshot.canRedo, true);
});

void test('loading a legacy-compatible project resets document history and keeps panel preferences', (): void => {
	const store = createEditorStore();
	store.dispatch({ type: 'panel/toggle', panelId: 'left', collapsed: true });
	const project = createWayfindingStudioProject('opened-project');
	project.name = 'Opened project';
	store.dispatch({ type: 'project/load', project, fileName: 'opened.wbwayfinding', openedFrom: 'file' });

	const snapshot = store.getSnapshot();
	assert.equal(snapshot.state.project.name, 'Opened project');
	assert.equal(snapshot.state.document.fileName, 'opened.wbwayfinding');
	assert.equal(snapshot.state.panels.left.collapsed, true);
	assert.equal(snapshot.canUndo, false);
});

void test('floor removal keeps at least one floor and selects a valid remaining floor', (): void => {
	const store = createEditorStore();
	store.dispatch({ type: 'floor/add', floorId: 'level-1', name: 'Level 1' });
	store.dispatch({
		type: 'destination/add',
		destination: {
			floor: 'level-1',
			id: 'gallery',
			name: 'Gallery',
			routeable: true
		}
	});
	store.dispatch({
		type: 'element/add',
		floorId: 'level-1',
		element: {
			destinationId: 'gallery',
			floorId: 'level-1',
			geometry: [{ x: 10, y: 10 }, { x: 110, y: 10 }, { x: 110, y: 110 }],
			id: 'gallery-location',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		}
	});
	store.dispatch({
		type: 'graph/node-add',
		node: { id: 'ground-node', kind: 'route', levelId: 'level-0', x: 10, y: 10 }
	});
	store.dispatch({
		type: 'graph/node-add',
		node: {
			id: 'gallery-node',
			kind: 'location',
			levelId: 'level-1',
			locationId: 'gallery',
			x: 20,
			y: 20
		}
	});
	store.dispatch({
		type: 'graph/edge-add',
		edge: {
			accessible: true,
			bidirectional: true,
			from: 'ground-node',
			id: 'floor-connection',
			kind: 'elevator',
			to: 'gallery-node'
		}
	});
	store.dispatch({ type: 'floor/select', floorId: 'level-1' });
	store.dispatch({ type: 'floor/remove', floorId: 'level-1' });

	const snapshot = store.getSnapshot();
	assert.equal(snapshot.state.currentFloorId, 'level-0');
	assert.equal(snapshot.state.project.floors.length, 1);
	assert.equal(snapshot.state.project.destinations.length, 0);
	assert.deepEqual(snapshot.state.project.graph.nodes.map((node) => node.id), ['ground-node']);
	assert.equal(snapshot.state.project.graph.edges.length, 0);
	store.dispatch({ type: 'floor/remove', floorId: 'level-0' });
	assert.equal(store.getSnapshot().state.project.floors.length, 1);
});

void test('floor reordering is transactional, bounded, and undoable', (): void => {
	const store = createEditorStore();
	store.dispatch({ type: 'floor/add', floorId: 'level-1', name: 'Level 1' });
	store.dispatch({ type: 'floor/add', floorId: 'level-2', name: 'Level 2' });
	store.dispatch({ type: 'floor/reorder', floorId: 'level-2', direction: -1 });

	assert.deepEqual(
		[...store.getSnapshot().state.project.floors]
			.sort((left, right): number => left.order - right.order)
			.map((floor): string => floor.id),
		['level-0', 'level-2', 'level-1']
	);

	store.dispatch({ type: 'floor/reorder', floorId: 'level-0', direction: -1 });
	assert.equal(
		store.getSnapshot().state.project.floors.find((floor): boolean => floor.id === 'level-0')?.order,
		0
	);

	store.undo();
	assert.deepEqual(
		[...store.getSnapshot().state.project.floors]
			.sort((left, right): number => left.order - right.order)
			.map((floor): string => floor.id),
		['level-0', 'level-1', 'level-2']
	);
});

void test('preview clears authoring selection without changing the selected view', (): void => {
	const store = createEditorStore();
	store.dispatch({ type: 'view/set', viewMode: '3d' });
	store.dispatch({ type: 'selection/set', selection: { id: 'location-1', kind: 'element' } });
	store.dispatch({ type: 'workspace/set', workspace: 'preview' });

	assert.equal(store.getSnapshot().state.workspace, 'preview');
	assert.equal(store.getSnapshot().state.viewMode, '3d');
	assert.equal(store.getSnapshot().state.selection, undefined);
});

void test('workspace transitions reject tools and selections that do not belong to the active workflow', (): void => {
	const store = createEditorStore();
	store.dispatch({ type: 'tool/set', tool: 'location' });
	store.dispatch({ type: 'selection/set', selection: { id: 'location-1', kind: 'element' } });
	store.dispatch({ type: 'workspace/set', workspace: 'route-edit' });

	assert.equal(store.getSnapshot().state.activeTool, 'select');
	assert.equal(store.getSnapshot().state.selection, undefined);

	store.dispatch({ type: 'tool/set', tool: 'location' });
	assert.equal(store.getSnapshot().state.activeTool, 'select');
	store.dispatch({ type: 'selection/set', selection: { id: 'edge-1', kind: 'graph-edge' } });
	store.dispatch({ type: 'workspace/set', workspace: 'preview' });
	assert.equal(store.getSnapshot().state.activeTool, 'pan');
	assert.equal(store.getSnapshot().state.selection, undefined);
});

void test('a location and its destination are created as one undoable authoring transaction', (): void => {
	const store = createEditorStore();

	store.run({
		commands: [
			{
				type: 'destination/add',
				destination: {
					floorId: 'level-0',
					id: 'destination-reception',
					name: 'Reception',
					routeable: true,
					status: 'confirmed'
				}
			},
			{
				type: 'element/add',
				floorId: 'level-0',
				element: {
					destinationId: 'destination-reception',
					floorId: 'level-0',
					geometry: [
						{ x: 10, y: 10 },
						{ x: 90, y: 10 },
						{ x: 90, y: 70 },
						{ x: 10, y: 70 }
					],
					id: 'location-reception',
					provenance: 'reviewer-authored',
					status: 'confirmed',
					type: 'location'
				}
			}
		],
		label: 'Create Reception'
	});

	let snapshot = store.getSnapshot();
	assert.equal(snapshot.state.project.destinations.length, 1);
	assert.equal(snapshot.state.project.floors[0].elements.length, 1);

	store.undo();
	snapshot = store.getSnapshot();
	assert.equal(snapshot.state.project.destinations.length, 0);
	assert.equal(snapshot.state.project.floors[0].elements.length, 0);

	store.redo();
	snapshot = store.getSnapshot();
	assert.equal(snapshot.state.project.destinations[0]?.name, 'Reception');
	assert.equal(snapshot.state.project.floors[0].elements[0]?.id, 'location-reception');
});

void test('tool and polygon draft changes do not pollute document history', (): void => {
	const store = createEditorStore();

	store.dispatch({ type: 'tool/set', tool: 'location' });
	store.dispatch({
		type: 'draft/set',
		draft: {
			elementType: 'location',
			kind: 'polygon',
			points: [
				{ x: 12, y: 16 },
				{ x: 48, y: 16 }
			]
		}
	});

	const snapshot = store.getSnapshot();
	assert.equal(snapshot.state.activeTool, 'location');
	assert.equal(snapshot.state.draft?.kind, 'polygon');
	assert.equal(snapshot.canUndo, false);
	assert.equal(snapshot.state.document.dirty, false);
});

void test('vertex edits are undoable while preserving the current camera', (): void => {
	const store = createEditorStore();
	const camera: EditorCamera2d = { offsetX: 240, offsetY: 96, scale: 2.4 };

	store.dispatch({
		type: 'element/add',
		floorId: 'level-0',
		element: {
			floorId: 'level-0',
			geometry: [
				{ x: 10, y: 10 },
				{ x: 90, y: 10 },
				{ x: 90, y: 70 },
				{ x: 10, y: 70 }
			],
			id: 'walkable-main',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		}
	});
	store.dispatch({
		type: 'element/patch',
		elementId: 'walkable-main',
		patch: {
			geometry: [
				{ x: 10, y: 10 },
				{ x: 110, y: 10 },
				{ x: 90, y: 70 },
				{ x: 10, y: 70 }
			]
		}
	});
	store.dispatch({ type: 'camera/set', floorId: 'level-0', camera });

	store.undo();
	const snapshot = store.getSnapshot();
	const element = snapshot.state.project.floors[0].elements[0];
	assert.equal(element.type, 'walkable');
	assert.deepEqual(element.type === 'walkable' ? element.geometry[1] : undefined, { x: 90, y: 10 });
	assert.deepEqual(snapshot.state.camera2dByFloor['level-0'], camera);
});

void test('route graph mutations keep edges and nodes referentially consistent', (): void => {
	const store = createEditorStore();

	store.run({
		commands: [
			{
				type: 'graph/node-add',
				node: { id: 'node-a', kind: 'route', levelId: 'level-0', x: 10, y: 10 }
			},
			{
				type: 'graph/node-add',
				node: { id: 'node-b', kind: 'route', levelId: 'level-0', x: 90, y: 10 }
			},
			{
				type: 'graph/edge-add',
				edge: {
					accessible: true,
					bidirectional: true,
					from: 'node-a',
					geometry: [
						{ x: 10, y: 10 },
						{ x: 90, y: 10 }
					],
					id: 'edge-a-b',
					kind: 'walk',
					to: 'node-b'
				}
			}
		],
		label: 'Create route segment'
	});

	assert.equal(store.getSnapshot().state.project.graph.edges.length, 1);
	store.dispatch({ type: 'graph/node-remove', nodeId: 'node-a' });
	assert.equal(store.getSnapshot().state.project.graph.nodes.length, 1);
	assert.equal(store.getSnapshot().state.project.graph.edges.length, 0);
	store.undo();
	assert.equal(store.getSnapshot().state.project.graph.nodes.length, 2);
	assert.equal(store.getSnapshot().state.project.graph.edges.length, 1);
});

void test('removing an asset clears destination and map references in one undoable edit', (): void => {
	const project = createWayfindingStudioProject('asset-reference-test');
	project.assets.push(
		{
			dataUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
			id: 'logo-reception',
			kind: 'logo',
			mimeType: 'image/svg+xml',
			name: 'Reception logo'
		},
		{
			dataUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
			id: 'photo-reception',
			kind: 'photo',
			mimeType: 'image/svg+xml',
			name: 'Reception photo'
		}
	);
	project.destinations.push({
		id: 'destination-reception',
		logoAssetId: 'logo-reception',
		name: 'Reception',
		photoAssetIds: ['photo-reception']
	});
	project.floors[0].elements.push({
		assetId: 'logo-reception',
		floorId: 'level-0',
		height: 48,
		id: 'logo-on-map',
		point: { x: 120, y: 80 },
		provenance: 'reviewer-authored',
		status: 'confirmed',
		type: 'logo',
		width: 48
	});

	const store = createEditorStore(createEditorState(project));
	store.dispatch({ type: 'asset/remove', assetId: 'logo-reception' });

	let snapshot = store.getSnapshot();
	assert.equal(snapshot.state.project.assets.some((asset): boolean => asset.id === 'logo-reception'), false);
	assert.equal(snapshot.state.project.destinations[0]?.logoAssetId, undefined);
	assert.equal(snapshot.state.project.floors[0].elements.length, 0);
	assert.deepEqual(snapshot.state.project.destinations[0]?.photoAssetIds, ['photo-reception']);

	store.undo();
	snapshot = store.getSnapshot();
	assert.equal(snapshot.state.project.assets.some((asset): boolean => asset.id === 'logo-reception'), true);
	assert.equal(snapshot.state.project.destinations[0]?.logoAssetId, 'logo-reception');
	assert.equal(snapshot.state.project.floors[0].elements[0]?.id, 'logo-on-map');
});
