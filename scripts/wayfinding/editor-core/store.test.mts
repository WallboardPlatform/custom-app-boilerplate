import assert from 'node:assert/strict';
import test from 'node:test';

import { createWayfindingStudioProject } from '../studio-project.mts';
import { createEditorState } from './state.ts';
import { createEditorStore } from './store.ts';

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
	store.dispatch({ type: 'floor/select', floorId: 'level-1' });
	store.dispatch({ type: 'floor/remove', floorId: 'level-1' });

	assert.equal(store.getSnapshot().state.currentFloorId, 'level-0');
	assert.equal(store.getSnapshot().state.project.floors.length, 1);
	store.dispatch({ type: 'floor/remove', floorId: 'level-0' });
	assert.equal(store.getSnapshot().state.project.floors.length, 1);
});

void test('visitor preview clears authoring selection without changing the selected view', (): void => {
	const store = createEditorStore();
	store.dispatch({ type: 'view/set', viewMode: '3d' });
	store.dispatch({ type: 'selection/set', selection: { id: 'location-1', kind: 'element' } });
	store.dispatch({ type: 'workspace/set', workspace: 'visitor-preview' });

	assert.equal(store.getSnapshot().state.workspace, 'visitor-preview');
	assert.equal(store.getSnapshot().state.viewMode, '3d');
	assert.equal(store.getSnapshot().state.selection, undefined);
});
