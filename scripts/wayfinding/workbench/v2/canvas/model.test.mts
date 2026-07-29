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

void test('route preview keeps spatial context while removing authoring-only labels', () => {
	const project = createWayfindingStudioProject();
	const rendered = renderEditorFloorSvg(project, project.floors[0].id, visibility, undefined, false, 'route-preview');

	assert.match(rendered, /#Labels\{display:none\}/);
	assert.doesNotMatch(rendered, /#Walkable\{display:none\}/);
	assert.match(rendered, /#Walkable polygon\{fill:#eef4f2/);
	assert.doesNotMatch(rendered, /#Origins\{display:none\}/);
});

void test('visitor presentation hides technical layers but retains styled map geometry', () => {
	const project = createWayfindingStudioProject();
	const rendered = renderEditorFloorSvg(project, project.floors[0].id, visibility, undefined, false, 'visitor');

	assert.match(rendered, /#Origins\{display:none\}/);
	assert.doesNotMatch(rendered, /#Locations\{display:none\}/);
	assert.match(rendered, /class="visitor-floor-surface"/);
	assert.match(rendered, /#Locations polygon\{fill-opacity:.86/);
	assert.match(rendered, /#Labels\{display:none\}/);
});
