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

void test('preview keeps the final map while removing authoring-only geometry', () => {
	const project = createWayfindingStudioProject();
	const rendered = renderEditorFloorSvg(project, project.floors[0].id, visibility, undefined, false, 'preview');

	assert.match(rendered, /#Labels\{display:none\}/);
	assert.match(rendered, /#Walkable\{display:none\}/);
	assert.match(rendered, /#Obstacles\{display:none\}/);
	assert.match(rendered, /#Doors\{display:none\}/);
	assert.match(rendered, /#Origins\{display:none\}/);
});

void test('preview presentation retains styled destination geometry without debug doors', () => {
	const project = createWayfindingStudioProject();
	const rendered = renderEditorFloorSvg(project, project.floors[0].id, visibility, undefined, false, 'preview');

	assert.match(rendered, /#Origins\{display:none\}/);
	assert.doesNotMatch(rendered, /#Locations\{display:none\}/);
	assert.match(rendered, /class="preview-floor-surface"/);
	assert.match(rendered, /#Locations polygon\{fill-opacity:.86/);
	assert.match(rendered, /#Labels\{display:none\}/);
	assert.match(rendered, /#Doors\{display:none\}/);
});

void test('selection emphasis never paints over authored text glyphs', () => {
	const project = createWayfindingStudioProject('selected-label');
	const floor = project.floors[0];
	floor.elements.push({
		floorId: floor.id,
		id: 'label-selected',
		point: { x: 120, y: 80 },
		provenance: 'reviewer-authored',
		status: 'confirmed',
		text: 'Welcome',
		type: 'label'
	});
	const rendered = renderEditorFloorSvg(
		project,
		floor.id,
		visibility,
		{ id: 'label-selected', kind: 'element' },
		false
	);

	assert.match(rendered, /\[id="label-selected"\]\{filter:drop-shadow/u);
	assert.doesNotMatch(rendered, /\[id="label-selected"\]\{filter:[^}]+;stroke:/u);
	assert.match(rendered, /polygon\[id="label-selected"\],line\[id="label-selected"\]/u);
});
