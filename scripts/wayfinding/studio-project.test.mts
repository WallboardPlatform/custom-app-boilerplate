import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { WayfindingGraph, type WayfindingWalkableMaskDocument } from '../../src/utils/wayfinding.js';
import { parseWayfindingStudioProjectSource } from './schema.mts';
import {
	createWayfindingRuntimeBundle,
	createWayfindingStudioProject,
	importAnnotatedWayfindingSvg,
	migrateWayfindingArtifacts,
	parseWayfindingStudioProject,
	renderWayfindingFloorSvg,
	synchronizeWayfindingStudioGraph,
	validateWayfindingStudioDelivery,
	validateWayfindingStudioProject,
	type WayfindingStudioProject
} from './studio-project.mts';

const confirmed = { provenance: 'reviewer-authored' as const, status: 'confirmed' as const };
const fullMask = (mapId: string, width: number, height: number): WayfindingWalkableMaskDocument => {
	const cellSize = 20;
	const columns = Math.ceil(width / cellSize);
	const rows = Math.ceil(height / cellSize);

return {
		cellSize,
		columns,
		contractVersion: 1 as const,
		height,
		mapId,
		reviewStatus: 'confirmed' as const,
		rows,
		walkableRuns: Array.from({ length: rows }, (_, row): [number, number, number] => [row, 0, columns - 1]),
		width
	};
};

const multiFloorProject = (): WayfindingStudioProject => {
	const project: WayfindingStudioProject = createWayfindingStudioProject('town-hall');
	project.delivery.guidance.targetMode = 'route';
	project.delivery.guidance.stepFreeRequired = true;
	project.delivery.source.levels = 2;

	for (const key of ['destinationMetadata', 'destinationAnchors', 'currentLocationAnchors', 'walkableSpace', 'routeTopology', 'entranceApproaches', 'levelTransitions', 'accessibility'] as const) project.delivery.evidence[key].status = 'confirmed';
	project.delivery.evidence.walkableSpace.independentFrom = ['routeTopology'];
	project.floors = [
		{
			elements: [
				{ ...confirmed, facingDegrees: 90, floorId: 'ground', id: 'lobby-screen', label: 'Main lobby', point: { x: 40, y: 100 }, screenId: 'screen-1', type: 'origin' },
				{ ...confirmed, accessible: true, connectionId: 'lift-a', floorId: 'ground', id: 'lift-a-ground', kind: 'elevator', label: 'Lift A', point: { x: 240, y: 100 }, type: 'transition' }
			],
			height: 600,
			id: 'ground',
			name: 'Ground floor',
			order: 0,
			walkableMask: fullMask('town-hall:ground', 900, 600),
			width: 900
		},
		{
			elements: [
				{ ...confirmed, accessible: true, connectionId: 'lift-a', floorId: 'first', id: 'lift-a-first', kind: 'elevator', label: 'Lift A', point: { x: 240, y: 120 }, type: 'transition' },
				{ ...confirmed, destinationId: 'council', floorId: 'first', geometry: [{ x: 550, y: 70 }, { x: 820, y: 70 }, { x: 820, y: 300 }, { x: 550, y: 300 }], id: 'council-room', label: 'Council chamber', type: 'location' },
				{ ...confirmed, angle: 0, floorId: 'first', id: 'council-door', length: 36, locationId: 'council-room', point: { x: 550, y: 170 }, type: 'door' },
				{ ...confirmed, color: '#264653', floorId: 'first', fontFamily: 'serif', fontSize: 32, fontWeight: 700, id: 'council-label', outlineColor: '#ffffff', outlineWidth: 2, point: { x: 610, y: 160 }, text: 'Council chamber', textAnchor: 'middle', type: 'label' }
			],
			height: 600,
			id: 'first',
			name: 'First floor',
			order: 1,
			walkableMask: fullMask('town-hall:first', 900, 600),
			width: 900
		}
	];
	project.destinations = [{ floor: 'first', id: 'council', name: 'Council chamber', routeable: true }];
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

void test('creates a portable project and migrates the evidence-only contract', () => {
	const original = createWayfindingStudioProject('museum');
	const parsed = parseWayfindingStudioProject(JSON.parse(JSON.stringify(original)));
	const schemaParsed = parseWayfindingStudioProjectSource(JSON.stringify(original));
	const migrated = migrateWayfindingArtifacts(original.delivery, undefined, [{ id: 'gallery', name: 'Gallery' }]);
	assert.equal(parsed.projectId, 'museum');
	assert.equal(schemaParsed.projectId, 'museum');
	assert.equal(migrated.floors.length, 1);
	assert.equal(migrated.destinations[0].id, 'gallery');
	assert.equal(parseWayfindingStudioProjectSource(fs.readFileSync(path.resolve('templates', 'wayfinding-studio-project.json'), 'utf8')).floors[0].id, 'level-0');
	assert.equal(parseWayfindingStudioProjectSource(fs.readFileSync(path.resolve('examples', 'veszprem-wayfinding', 'veszprem-downtown.wbwayfinding'), 'utf8')).destinations.length, 36);
});

void test('keeps every authored entrance for a multi-door destination', () => {
	const project = createWayfindingStudioProject('multi-entrance');
	const floor = project.floors[0];
	floor.elements = [
		{ ...confirmed, destinationId: 'auditorium', floorId: floor.id, geometry: [{ x: 200, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 400 }, { x: 200, y: 400 }], id: 'auditorium-shape', label: 'Auditorium', type: 'location' },
		{ ...confirmed, angle: 0, floorId: floor.id, id: 'auditorium-west-door', length: 36, locationId: 'auditorium-shape', point: { x: 200, y: 240 }, type: 'door' },
		{ ...confirmed, angle: 0, floorId: floor.id, id: 'auditorium-east-door', length: 36, locationId: 'auditorium-shape', point: { x: 600, y: 240 }, type: 'door' }
	];
	project.destinations = [{ floor: floor.id, id: 'auditorium', name: 'Auditorium', routeable: true }];
	synchronizeWayfindingStudioGraph(project);
	const entrances = project.graph.nodes.filter((node): boolean => node.kind === 'location' && node.locationId === 'auditorium');
	assert.deepEqual(entrances.map((node): string => node.id), ['semantic:auditorium-shape', 'semantic:auditorium-east-door']);
	assert.deepEqual(entrances.map((node): number => node.x), [200, 600]);
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
	project.floors[1].elements.push(
		{ ...confirmed, floorId: 'first', geometry: [{ x: 100, y: 350 }, { x: 400, y: 350 }, { x: 400, y: 500 }, { x: 100, y: 500 }], id: 'first-walkable', label: 'Authoring corridor', type: 'walkable' },
		{ ...confirmed, floorId: 'first', geometry: [{ x: 420, y: 350 }, { x: 500, y: 350 }, { x: 500, y: 430 }, { x: 420, y: 430 }], id: 'first-obstacle', label: 'Authoring exclusion', type: 'obstacle' }
	);
	assert.ok(project.presentation);
	project.presentation.route = { color: '#cc2244', cornerRounding: 30, width: 9 };
	project.presentation.polygons.walkable.fillOpacity = 0.35;
	const councilRoom = project.floors[1].elements.find((element): boolean => element.id === 'council-room');
	assert.ok(councilRoom && 'geometry' in councilRoom);
	councilRoom.presentation = { extrusionHeight: 42, fillColor: '#336699', fillOpacity: 0.84 };
	const svg = renderWayfindingFloorSvg(project, 'first');
	const bundle = createWayfindingRuntimeBundle(project);
	assert.match(svg, /<g id="Background">/u);
	assert.match(svg, /<g id="Locations"/u);
	assert.match(svg, /<g id="Walkable" data-authoring-only="true" style="display:none"/u);
	assert.match(svg, /<g id="Obstacles" data-authoring-only="true" style="display:none"/u);
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
	assert.ok(!bundle.floors[1].elements.some((element): boolean => element.type === 'walkable' || element.type === 'obstacle'));
	assert.equal(bundle.destinations.Destinations.rows[0].name, 'Council chamber');
	assert.equal(bundle.manifest.deliveryMode, 'route');
	assert.deepEqual(bundle.presentation.route, { color: '#cc2244', cornerRounding: 30, width: 9 });
});

void test('keeps incomplete route drafts editable while blocking runtime export', () => {
	const project = createWayfindingStudioProject('route-draft');
	project.delivery.guidance.targetMode = 'route';
	assert.equal(parseWayfindingStudioProject(JSON.parse(JSON.stringify(project))).projectId, 'route-draft');
	assert.deepEqual(validateWayfindingStudioProject(project).filter((issue): boolean => issue.severity === 'error'), []);
	assert.ok(validateWayfindingStudioDelivery(project).some((issue): boolean => issue.code === 'delivery-evidence-blocked'));
});

void test('exports the maintained Veszprem project only in its evidence-supported highlight mode', () => {
	const project = parseWayfindingStudioProjectSource(fs.readFileSync(path.resolve('examples', 'veszprem-wayfinding', 'veszprem-downtown.wbwayfinding'), 'utf8'));
	const bundle = createWayfindingRuntimeBundle(project);
	assert.deepEqual(validateWayfindingStudioDelivery(project).filter((issue): boolean => issue.severity === 'error'), []);
	assert.equal(bundle.manifest.targetMode, 'highlight');
	assert.equal(bundle.manifest.deliveryMode, 'highlight');
	assert.equal(bundle.graph.nodes.length, 0);
});

void test('imports reviewed circle and polygon hit geometry from an annotated SVG', () => {
	const project = createWayfindingStudioProject('imported-map');
	const count = importAnnotatedWayfindingSvg(project, 'level-0', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><circle id="lobby-hit" data-wayfinding-location-id="lobby" cx="12" cy="16" r="5"/><polygon id="hall-hit" data-wayfinding-location-id="hall" points="20,20 60,20 60,60 20,60"/></svg>');
	assert.equal(count, 2);
	assert.equal(project.floors[0].elements[0].type, 'poi');
	assert.equal(project.floors[0].elements[1].type, 'location');
});

void test('materializes paired transitions and routes across floors', () => {
	const project = multiFloorProject();
	const route = new WayfindingGraph(project.graph).route('semantic:lobby-screen', 'semantic:council-room', { profile: 'step-free' });
	assert.ok(route);
	assert.ok(route.edgeIds.some((id: string): boolean => id.startsWith('semantic-transition:lift-a:')));
	assert.deepEqual([...new Set(route.nodeIds.map((id: string): string | undefined => project.graph.nodes.find((node): boolean => node.id === id)?.levelId))], ['ground', 'first']);
	assert.deepEqual(validateWayfindingStudioDelivery(project).filter((issue): boolean => issue.severity === 'error'), []);
});

void test('blocks route delivery when graph coverage is disconnected or unreviewed', () => {
	const project = multiFloorProject();
	project.graph.edges = project.graph.edges.filter((edge): boolean => edge.id !== 'first-council');
	const groundEntry = project.graph.edges.find((edge): boolean => edge.id === 'ground-entry');
	assert.ok(groundEntry);
	groundEntry.reviewStatus = 'proposed';
	const issues = validateWayfindingStudioDelivery(project);
	assert.ok(issues.some((issue): boolean => issue.code === 'disconnected-route'));
	assert.ok(issues.some((issue): boolean => issue.code === 'disconnected-step-free-route'));
	assert.ok(issues.some((issue): boolean => issue.code === 'unconfirmed-route-edge'));
});

void test('requires confirmed entrance geometry for routeable room polygons', () => {
	const project = multiFloorProject();
	project.floors[1].elements = project.floors[1].elements.filter((element): boolean => element.id !== 'council-door');
	project.floors[0].elements[0].status = 'proposed';
	synchronizeWayfindingStudioGraph(project);
	const issues = validateWayfindingStudioDelivery(project);
	assert.ok(issues.some((issue): boolean => issue.code === 'missing-location-door'));
	assert.ok(issues.some((issue): boolean => issue.code === 'unconfirmed-route-element'));
});

void test('requires an independently confirmed walkable mask for every routed floor', () => {
	const project = multiFloorProject();
	delete project.floors[1].walkableMask;
	const issues = validateWayfindingStudioDelivery(project);
	assert.ok(issues.some((issue): boolean => issue.code === 'missing-route-mask' && issue.elementIds.includes('first-council')));
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
