import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { WayfindingGraph } from '../../src/utils/wayfinding.js';
import { parseWayfindingStudioProjectSource } from './schema.mts';
import {
	createWayfindingRuntimeBundle,
	createWayfindingStudioProject,
	parseWayfindingStudioProject,
	repairWayfindingStudioProject,
	renderWayfindingFloorSvg,
	synchronizeWayfindingStudioGraph,
	validateWayfindingStudioPublish,
	validateWayfindingStudioProject,
	type WayfindingStudioProject
} from './studio-project.mts';

const confirmed = { provenance: 'reviewer-authored' as const, status: 'confirmed' as const };

const multiFloorProject = (): WayfindingStudioProject => {
	const project: WayfindingStudioProject = createWayfindingStudioProject('town-hall');
	project.floors = [
		{
			elements: [
				{ ...confirmed, floorId: 'ground', geometry: [{ x: 0, y: 0 }, { x: 900, y: 0 }, { x: 900, y: 600 }, { x: 0, y: 600 }], id: 'ground-walkable', type: 'walkable' },
				{ ...confirmed, facingDegrees: 90, floorId: 'ground', id: 'lobby-screen', label: 'Main lobby', point: { x: 40, y: 100 }, screenId: 'screen-1', type: 'origin' },
				{ ...confirmed, accessible: true, connectionId: 'lift-a', floorId: 'ground', id: 'lift-a-ground', kind: 'elevator', label: 'Lift A', point: { x: 240, y: 100 }, type: 'transition' }
			],
			height: 600,
			id: 'ground',
			name: 'Ground floor',
			order: 0,
			width: 900
		},
		{
			elements: [
				{ ...confirmed, floorId: 'first', geometry: [{ x: 0, y: 0 }, { x: 900, y: 0 }, { x: 900, y: 600 }, { x: 0, y: 600 }], id: 'first-walkable', type: 'walkable' },
				{ ...confirmed, accessible: true, connectionId: 'lift-a', floorId: 'first', id: 'lift-a-first', kind: 'elevator', label: 'Lift A', point: { x: 240, y: 120 }, type: 'transition' },
				{ ...confirmed, destinationId: 'council', floorId: 'first', geometry: [{ x: 550, y: 70 }, { x: 820, y: 70 }, { x: 820, y: 300 }, { x: 550, y: 300 }], id: 'council-room', label: 'Council chamber', type: 'location' },
				{ ...confirmed, angle: 0, floorId: 'first', id: 'council-door', length: 36, locationId: 'council-room', point: { x: 550, y: 170 }, type: 'door' },
				{ ...confirmed, color: '#264653', floorId: 'first', fontFamily: 'serif', fontSize: 32, fontWeight: 700, id: 'council-label', outlineColor: '#ffffff', outlineWidth: 2, point: { x: 610, y: 160 }, text: 'Council chamber', textAnchor: 'middle', type: 'label' }
			],
			height: 600,
			id: 'first',
			name: 'First floor',
			order: 1,
			width: 900
		}
	];
	project.destinations = [{ accessible: true, floor: 'first', id: 'council', name: 'Council chamber', routeable: true }];
	synchronizeWayfindingStudioGraph(project);
	project.graph.nodes.push(
		{ id: 'ground-junction', kind: 'route', levelId: 'ground', x: 200, y: 100 },
		{ id: 'first-junction', kind: 'route', levelId: 'first', x: 300, y: 120 }
	);
	project.graph.edges.push(
		{ accessible: true, bidirectional: true, from: 'semantic:lobby-screen', geometry: [{ x: 40, y: 100 }, { x: 200, y: 100 }], id: 'ground-entry', kind: 'walk', reviewStatus: 'confirmed', to: 'ground-junction', traversal: 'indoor-corridor' },
		{ accessible: true, bidirectional: true, from: 'ground-junction', geometry: [{ x: 200, y: 100 }, { x: 240, y: 100 }], id: 'ground-lift', kind: 'walk', reviewStatus: 'confirmed', to: 'semantic:lift-a-ground', traversal: 'indoor-corridor' },
		{ accessible: true, bidirectional: true, from: 'semantic:lift-a-first', geometry: [{ x: 240, y: 120 }, { x: 300, y: 120 }], id: 'first-lift', kind: 'walk', reviewStatus: 'confirmed', to: 'first-junction', traversal: 'indoor-corridor' },
		{ accessible: true, bidirectional: true, from: 'first-junction', geometry: [{ x: 300, y: 120 }, { x: 550, y: 170 }], id: 'first-council', kind: 'walk', reviewStatus: 'confirmed', to: 'semantic:council-room', traversal: 'indoor-corridor' }
	);

return project;
};

void test('creates and validates a portable Studio project', () => {
	const original = createWayfindingStudioProject('museum');
	const parsed = parseWayfindingStudioProject(JSON.parse(JSON.stringify(original)));
	const schemaParsed = parseWayfindingStudioProjectSource(JSON.stringify(original));
	assert.equal(parsed.projectId, 'museum');
	assert.deepEqual(parsed.defaults?.origin, {
		animation2d: 'radar',
		animation3d: 'bounce',
		animationSpeed: 48,
		color: '#138b75'
	});
	assert.equal(schemaParsed.projectId, 'museum');
	assert.equal(parseWayfindingStudioProjectSource(fs.readFileSync(path.resolve('templates', 'wayfinding-studio-project.json'), 'utf8')).floors[0].id, 'level-0');
	assert.equal(parseWayfindingStudioProjectSource(fs.readFileSync(path.resolve('examples', 'veszprem-wayfinding', 'veszprem-downtown.wbwayfinding'), 'utf8')).destinations.length, 36);
});

void test('recovers bounded geometry without resizing the floor or discarding valid project data', () => {
	const project = createWayfindingStudioProject('recoverable');
	project.floors[0].width = 100;
	project.floors[0].height = 80;
	project.floors[0].elements.push({
		...confirmed,
		floorId: 'level-0',
		geometry: [{ x: 20, y: 20 }, { x: 120, y: 20 }, { x: 120, y: 70 }, { x: 20, y: 70 }],
		id: 'walkable-overflow',
		type: 'walkable'
	});
	project.graph.nodes.push({ id: 'valid-node', kind: 'route', levelId: 'level-0', x: 40, y: 40 });

	assert.throws((): void => { parseWayfindingStudioProject(JSON.parse(JSON.stringify(project))); }, /out-of-bounds/);
	const recovered = repairWayfindingStudioProject(JSON.parse(JSON.stringify(project)));
	const polygon = recovered.project.floors[0].elements[0];
	assert.equal(recovered.project.floors[0].width, 100);
	assert.equal(recovered.project.graph.nodes[0].id, 'valid-node');
	assert.equal(recovered.repairs.length, 1);
	assert.equal(recovered.repairs[0].code, 'clipped-polygon');
	assert.equal(polygon.type, 'walkable');

	if (!('geometry' in polygon)) assert.fail('Expected polygon geometry');
	assert.equal(Math.max(...polygon.geometry.map((point): number => point.x)), 100);
	assert.equal(polygon.status, 'proposed');
	assert.equal(parseWayfindingStudioProject(recovered.project).projectId, 'recoverable');
});

void test('removes orphaned managed route anchors without touching valid or manual route work', () => {
	const project = createWayfindingStudioProject('stale-managed-anchor');
	project.graph.nodes.push(
		{
			id: 'semantic:deleted-location',
			kind: 'location',
			levelId: 'level-0',
			locationId: 'deleted-destination',
			semanticElementId: 'deleted-location',
			x: 40,
			y: 40
		},
		{ authoringOwnership: 'manual', id: 'manual-a', kind: 'route', levelId: 'level-0', x: 80, y: 80 },
		{ authoringOwnership: 'manual', id: 'manual-b', kind: 'route', levelId: 'level-0', x: 120, y: 80 }
	);
	project.graph.edges.push({
		accessible: true,
		authoringOwnership: 'manual',
		bidirectional: true,
		from: 'manual-a',
		id: 'manual-edge',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'manual-b',
		traversal: 'indoor-corridor'
	});

	const recovered = repairWayfindingStudioProject(project);

	assert.deepEqual(recovered.project.graph.nodes.map((node): string => node.id), ['manual-a', 'manual-b']);
	assert.deepEqual(recovered.project.graph.edges.map((edge): string => edge.id), ['manual-edge']);
	assert.deepEqual(recovered.repairs, [{
		code: 'removed-orphaned-managed-route-node',
		elementIds: ['semantic:deleted-location'],
		message: 'Removed an obsolete route anchor left behind by deleted map content. No manual route work was changed.'
	}]);
	assert.equal(parseWayfindingStudioProject(recovered.project).projectId, 'stale-managed-anchor');
});

void test('removes generated connectors with an orphaned managed route anchor', () => {
	const project = createWayfindingStudioProject('stale-managed-connector');
	project.graph.nodes.push(
		{
			id: 'semantic:deleted-location',
			kind: 'location',
			levelId: 'level-0',
			locationId: 'deleted-destination',
			semanticElementId: 'deleted-location',
			x: 40,
			y: 40
		},
		{ authoringOwnership: 'generated', id: 'generated:level-0:node:1', kind: 'route', levelId: 'level-0', x: 80, y: 80 }
	);
	project.graph.edges.push({
		accessible: true,
		authoringOwnership: 'generated',
		bidirectional: true,
		from: 'semantic:deleted-location',
		id: 'generated:level-0:connector:semantic:deleted-location',
		kind: 'walk',
		reviewStatus: 'proposed',
		to: 'generated:level-0:node:1',
		traversal: 'portal'
	});

	const recovered = repairWayfindingStudioProject(project);

	assert.deepEqual(recovered.project.graph.nodes.map((node): string => node.id), ['generated:level-0:node:1']);
	assert.deepEqual(recovered.project.graph.edges, []);
	assert.deepEqual(recovered.repairs[0].elementIds, [
		'semantic:deleted-location',
		'generated:level-0:connector:semantic:deleted-location'
	]);
	assert.equal(parseWayfindingStudioProject(recovered.project).projectId, 'stale-managed-connector');
});

void test('refuses to discard a manual edge attached to an orphaned managed route anchor', () => {
	const project = createWayfindingStudioProject('unsafe-stale-managed-anchor');
	project.graph.nodes.push(
		{
			id: 'semantic:deleted-location',
			kind: 'location',
			levelId: 'level-0',
			locationId: 'deleted-destination',
			semanticElementId: 'deleted-location',
			x: 40,
			y: 40
		},
		{ authoringOwnership: 'manual', id: 'manual-node', kind: 'route', levelId: 'level-0', x: 80, y: 80 }
	);
	project.graph.edges.push({
		accessible: true,
		authoringOwnership: 'manual',
		bidirectional: true,
		from: 'semantic:deleted-location',
		id: 'manual-edge',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'manual-node',
		traversal: 'portal'
	});

	assert.throws(
		(): void => { repairWayfindingStudioProject(project); },
		/references missing semantic element 'deleted-location'/
	);
});

void test('removes obsolete standalone door anchors during synchronization', () => {
	const project = createWayfindingStudioProject('door-routing');
	project.floors[0].elements.push({
		...confirmed,
		angle: 0,
		floorId: 'level-0',
		id: 'meeting-room-door',
		length: 32,
		point: { x: 80, y: 60 },
		type: 'door'
	});
	project.graph.nodes.push(
		{ id: 'corridor', kind: 'route', levelId: 'level-0', x: 30, y: 60 },
		{ id: 'semantic:meeting-room-door', kind: 'route', levelId: 'level-0', semanticElementId: 'meeting-room-door', x: 80, y: 60 }
	);
	project.graph.edges.push({
		accessible: true,
		bidirectional: true,
		from: 'corridor',
		geometry: [{ x: 30, y: 60 }, { x: 80, y: 60 }],
		id: 'corridor-to-door',
		kind: 'walk',
		reviewStatus: 'proposed',
		to: 'semantic:meeting-room-door',
		traversal: 'indoor-corridor'
	});
	synchronizeWayfindingStudioGraph(project);

	assert.equal(project.graph.nodes.some((node): boolean => node.id === 'semantic:meeting-room-door'), false);
	assert.equal(project.graph.edges.some((edge): boolean => edge.id === 'corridor-to-door'), false);
});

void test('uses one canonical route anchor for a destination and its primary linked door', () => {
	const project = createWayfindingStudioProject('linked-door-routing');
	project.destinations.push({
		floor: 'level-0',
		id: 'meeting-room',
		name: 'Meeting room',
		routeable: true
	});
	project.floors[0].elements.push(
		{
			...confirmed,
			destinationId: 'meeting-room',
			floorId: 'level-0',
			geometry: [
				{ x: 60, y: 30 },
				{ x: 140, y: 30 },
				{ x: 140, y: 90 },
				{ x: 60, y: 90 }
			],
			id: 'meeting-room-shape',
			type: 'location'
		},
		{
			...confirmed,
			angle: 0,
			floorId: 'level-0',
			id: 'meeting-room-door',
			length: 32,
			locationId: 'meeting-room-shape',
			point: { x: 80, y: 90 },
			type: 'door'
		}
	);
	project.graph.nodes.push(
		{ id: 'corridor', kind: 'route', levelId: 'level-0', x: 30, y: 90 },
		{ id: 'semantic:meeting-room-door', kind: 'route', levelId: 'level-0', semanticElementId: 'meeting-room-door', x: 80, y: 90 }
	);
	project.graph.edges.push({
		accessible: true,
		bidirectional: true,
		from: 'corridor',
		geometry: [{ x: 30, y: 90 }, { x: 80, y: 90 }],
		id: 'corridor-to-door',
		kind: 'walk',
		reviewStatus: 'proposed',
		to: 'semantic:meeting-room-door',
		traversal: 'portal'
	});

	synchronizeWayfindingStudioGraph(project);

	const destinationNode = project.graph.nodes.find((node): boolean => node.locationId === 'meeting-room');

	assert.ok(destinationNode);
	assert.equal(destinationNode.id, 'semantic:meeting-room-shape');
	assert.equal(destinationNode.x, 80);
	assert.equal(destinationNode.y, 90);
	assert.equal(
		project.graph.nodes.some((node): boolean => node.id === 'semantic:meeting-room-door'),
		false
	);
	assert.equal(
		project.graph.edges.find((edge): boolean => edge.id === 'corridor-to-door')?.to,
		'semantic:meeting-room-shape'
	);
});

void test('generates stable semantic SVG layers and a runtime bundle', () => {
	const project = multiFloorProject();
	project.assets.push({
		dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
		id: 'first-floor-plan',
		kind: 'background',
		mimeType: 'image/png',
		name: 'First floor plan'
	});
	project.floors[1].backgroundAssetId = 'first-floor-plan';
	project.floors[1].camera3d = { azimuthDegrees: 32, distance: 780, pitchDegrees: 46, targetX: 450, targetY: 300 };
	const councilRoom = project.floors[1].elements.find((element): boolean => element.id === 'council-room');
	assert.ok(councilRoom && 'geometry' in councilRoom);
	councilRoom.presentation = { extrusionHeight: 42, fillColor: '#336699', fillOpacity: 0.84 };
	const svg = renderWayfindingFloorSvg(project, 'first');
	const bundle = createWayfindingRuntimeBundle(project);
	assert.match(svg, /<g id="Background">/u);
	assert.match(svg, /<g id="Locations"/u);
	assert.match(svg, /data-wayfinding-location-id="council"/u);
	assert.match(svg, /data-extrusion-height="42" fill="#336699" fill-opacity="0.84"/u);
	assert.match(svg, /<g id="Doors"/u);
	assert.match(svg, /<g id="Labels"/u);
	assert.match(svg, /fill="#264653" font-family="Georgia, serif" font-size="32" font-weight="700" text-anchor="middle" stroke="#ffffff" stroke-width="2"/u);
	assert.equal(bundle.floors.length, 2);
	assert.equal(bundle.assets[0].id, 'first-floor-plan');
	assert.equal(bundle.floors[1].backgroundAssetId, 'first-floor-plan');
	assert.equal(bundle.floors[1].camera3d?.pitchDegrees, 46);
	assert.deepEqual(bundle.floors[1].elements.find((element): boolean => element.id === 'council-room'), councilRoom);
	assert.equal(bundle.destinations.Destinations.rows[0].name, 'Council chamber');
	assert.equal(bundle.manifest.capabilities.routing, true);
	assert.equal(bundle.manifest.capabilities.stepFreeRouting, true);
});

void test('renders map media around its authored center point', () => {
	const project = createWayfindingStudioProject('centered-media');
	const floor = project.floors[0];
	project.assets.push({
		dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
		id: 'centered-logo',
		kind: 'logo',
		mimeType: 'image/png',
		name: 'Centered logo'
	});
	floor.elements.push({
		...confirmed,
		assetId: 'centered-logo',
		floorId: floor.id,
		height: 60,
		id: 'centered-logo-element',
		point: { x: 240, y: 180 },
		rotationDegrees: 30,
		type: 'logo',
		width: 120
	});

	const svg = renderWayfindingFloorSvg(project, floor.id);

	assert.match(svg, /id="centered-logo-element"[^>]+x="180" y="150" width="120" height="60"/u);
	assert.match(svg, /transform="rotate\(30 240 180\)"/u);
});

void test('preserves project languages, categories, and translated destination metadata in runtime output', () => {
	const project = createWayfindingStudioProject('multilingual-directory');
	project.categories = ['Dining', 'Services'];
	project.defaultLanguage = 'en';
	project.languages = [
		{ code: 'en', label: 'English' },
		{ code: 'hu', label: 'Magyar' }
	];
	project.destinations = [{
		category: 'Services',
		description: 'Visitor information and ticketing.',
		floor: 'level-0',
		id: 'visitor-information',
		name: 'Visitor information',
		routeable: false,
		translations: {
			hu: {
				description: 'Turisztikai információ és jegyértékesítés.',
				name: 'Tourinform'
			}
		}
	}];

	const parsed = parseWayfindingStudioProject(JSON.parse(JSON.stringify(project)));
	const bundle = createWayfindingRuntimeBundle(parsed);
	assert.deepEqual(parsed.languages, project.languages);
	assert.deepEqual(bundle.categories, ['Dining', 'Services']);
	assert.equal(bundle.defaultLanguage, 'en');
	assert.deepEqual(bundle.languages, project.languages);
	assert.equal(bundle.destinations.Destinations.rows[0].translations?.hu?.name, 'Tourinform');
});

void test('keeps incomplete route drafts editable while reporting concrete runtime defects', () => {
	const project = createWayfindingStudioProject('route-draft');
	project.graph.nodes = [
		{ authoringOwnership: 'manual', id: 'route-a', kind: 'route', levelId: 'level-0', x: 100, y: 100 },
		{ authoringOwnership: 'manual', id: 'route-b', kind: 'route', levelId: 'level-0', x: 200, y: 100 }
	];
	project.graph.edges = [{
		accessible: true,
		authoringOwnership: 'manual',
		bidirectional: true,
		from: 'route-a',
		id: 'route-a-b',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'route-b',
		traversal: 'indoor-corridor'
	}];
	assert.equal(parseWayfindingStudioProject(JSON.parse(JSON.stringify(project))).projectId, 'route-draft');
	assert.deepEqual(validateWayfindingStudioProject(project).filter((issue): boolean => issue.severity === 'error'), []);
	const issues = validateWayfindingStudioPublish(project);
	assert.ok(issues.some((issue): boolean => issue.code === 'missing-route-origin'));
	assert.ok(issues.some((issue): boolean => issue.code === 'missing-route-destination'));
});

void test('materializes paired transitions and routes across floors', () => {
	const project = multiFloorProject();
	const route = new WayfindingGraph(project.graph).route('semantic:lobby-screen', 'semantic:council-room', { profile: 'step-free' });
	assert.ok(route);
	assert.ok(route.edgeIds.some((id: string): boolean => id.startsWith('semantic-transition:lift-a:')));
	assert.deepEqual([...new Set(route.nodeIds.map((id: string): string | undefined => project.graph.nodes.find((node): boolean => node.id === id)?.levelId))], ['ground', 'first']);
	assert.deepEqual(validateWayfindingStudioPublish(project).filter((issue): boolean => issue.severity === 'error'), []);
});

void test('blocks publishing when route coverage is disconnected without requiring review flags', () => {
	const project = multiFloorProject();
	project.graph.edges = project.graph.edges.filter((edge): boolean => edge.id !== 'first-council');
	const groundEntry = project.graph.edges.find((edge): boolean => edge.id === 'ground-entry');
	assert.ok(groundEntry);
	groundEntry.reviewStatus = 'proposed';
	const issues = validateWayfindingStudioPublish(project);
	assert.ok(issues.some((issue): boolean => issue.code === 'disconnected-route'));
	assert.ok(issues.some((issue): boolean => issue.code === 'disconnected-step-free-route'));
	assert.ok(!issues.some((issue): boolean => issue.code === 'unconfirmed-route-edge'));
});

void test('requires entrance geometry for routeable room polygons without requiring review flags', () => {
	const project = multiFloorProject();
	project.floors[1].elements = project.floors[1].elements.filter((element): boolean => element.id !== 'council-door');
	project.floors[0].elements[0].status = 'proposed';
	synchronizeWayfindingStudioGraph(project);
	const issues = validateWayfindingStudioPublish(project);
	assert.ok(issues.some((issue): boolean => issue.code === 'missing-location-door'));
	assert.ok(!issues.some((issue): boolean => issue.code === 'unconfirmed-route-element'));
});

void test('allows only the short doorway threshold of a verified portal outside pedestrian space', () => {
	const project = multiFloorProject();
	const firstFloor = project.floors[1];
	const walkable = firstFloor.elements.find((element) => element.type === 'walkable');
	const portal = project.graph.edges.find((edge) => edge.id === 'first-council');
	assert.ok(walkable?.type === 'walkable');
	assert.ok(portal);
	walkable.geometry = [
		{ x: 0, y: 0 },
		{ x: 540, y: 0 },
		{ x: 540, y: 175 },
		{ x: 900, y: 175 },
		{ x: 900, y: 600 },
		{ x: 0, y: 600 }
	];
	portal.traversal = 'portal';

	assert.ok(!validateWayfindingStudioPublish(project).some((issue): boolean =>
		issue.code === 'route-leaves-walkable-space'
		&& issue.elementIds.includes(portal.id)
	));

	portal.geometry = [
		{ x: 300, y: 120 },
		{ x: 700, y: 100 },
		{ x: 550, y: 170 }
	];
	assert.ok(validateWayfindingStudioPublish(project).some((issue): boolean =>
		issue.code === 'route-leaves-walkable-space'
		&& issue.elementIds.includes(portal.id)
	));
});

void test('requires editable vector pedestrian space for every routed floor', () => {
	const project = multiFloorProject();
	project.floors[1].elements = project.floors[1].elements.filter((element) => element.type !== 'walkable');
	const issues = validateWayfindingStudioPublish(project);
	assert.ok(issues.some((issue): boolean =>
		issue.code === 'missing-route-pedestrian-area'
		&& issue.elementIds.includes('first-council')
	));
});

void test('rejects duplicate ids and warns about unpaired transitions', () => {
	const project = createWayfindingStudioProject('invalid');
	project.floors[0].elements.push(
		{ ...confirmed, accessible: false, connectionId: 'stairs-b', floorId: 'level-0', id: 'duplicate', kind: 'stairs', label: 'Stairs B', point: { x: 20, y: 20 }, type: 'transition' },
		{ ...confirmed, floorId: 'level-0', id: 'duplicate', point: { x: 50, y: 50 }, text: 'Duplicate', type: 'label' }
	);
	const issues = validateWayfindingStudioProject(project);
	assert.ok(issues.some((issue): boolean => issue.code === 'duplicate-id' && issue.severity === 'error'));
	assert.ok(issues.some((issue): boolean => issue.code === 'unpaired-transition' && issue.severity === 'warning'));
});
