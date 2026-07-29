import assert from 'node:assert/strict';
import test from 'node:test';

import type { EditorLayerId } from '../../../editor-core/types.ts';
import { createWayfindingStudioProject } from '../../../studio-project.mts';
import { renderEditorFloorSvg } from './model.ts';

const visibility = Object.fromEntries([
	'background',
	'door',
	'icon',
	'label',
	'location',
	'logo',
	'obstacle',
	'origin',
	'poi',
	'route',
	'transition',
	'walkable'
].map((layer) => [layer, true])) as Record<EditorLayerId, boolean>;

void test('route preview removes authoring evidence while retaining the installed origin', () => {
	const project = createWayfindingStudioProject();
	const rendered = renderEditorFloorSvg(project, project.floors[0].id, visibility, undefined, false, 'route-preview');

	assert.match(rendered, /#Labels\{display:none\}/);
	assert.match(rendered, /#Walkable\{display:none\}/);
	assert.doesNotMatch(rendered, /#Origins\{display:none\}/);
});

void test('visitor presentation removes every authoring overlay', () => {
	const project = createWayfindingStudioProject();
	const rendered = renderEditorFloorSvg(project, project.floors[0].id, visibility, undefined, false, 'visitor');

	assert.match(rendered, /#Origins\{display:none\}/);
	assert.match(rendered, /#Locations\{display:none\}/);
	assert.match(rendered, /#Labels\{display:none\}/);
});
