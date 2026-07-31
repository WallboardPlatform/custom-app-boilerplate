import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createWayfindingStudioProject,
	parseWayfindingStudioProject,
	repairWayfindingStudioProject,
	validateWayfindingStudioProject,
	type WayfindingStudioProject
} from '../studio-project.mts';

const buildComplexProject = (): WayfindingStudioProject => {
	const project = createWayfindingStudioProject('roundtrip-campus');
	const level0 = project.floors[0];

	project.name = 'Northline Campus';
	project.categories = ['Dining', 'Learning', 'Services'];
	project.languages = [
		{ code: 'en', label: 'English' },
		{ code: 'hu', label: 'Hungarian' }
	];
	project.defaultLanguage = 'hu';
	project.defaults = {
		...project.defaults!,
		iconSize: 80,
		locationColor: { fixedColor: '#5aa897', mode: 'random' },
		route: {
			animation: 'flow',
			animationSpeed: 72,
			color: '#e5483f',
			cornerRadius: 22,
			lineWidth: 9
		}
	};
	project.assets = [
		{
			dataUrl: 'data:image/png;base64,AA==',
			id: 'background-level-0',
			kind: 'background',
			mimeType: 'image/png',
			name: 'Ground floor.png',
			naturalHeight: 1080,
			naturalWidth: 1920
		},
		{
			dataUrl: 'data:image/svg+xml;base64,AA==',
			id: 'icon-cafe',
			kind: 'icon',
			mimeType: 'image/svg+xml',
			name: 'Cafe.svg',
			naturalHeight: 64,
			naturalWidth: 64
		},
		{
			dataUrl: 'data:image/svg+xml;base64,AA==',
			id: 'logo-library',
			kind: 'logo',
			mimeType: 'image/svg+xml',
			name: 'Library logo.svg',
			naturalHeight: 120,
			naturalWidth: 240
		},
		{
			dataUrl: 'data:image/jpeg;base64,AA==',
			id: 'photo-library',
			kind: 'photo',
			mimeType: 'image/jpeg',
			name: 'Library interior.jpg',
			naturalHeight: 900,
			naturalWidth: 1600
		}
	];
	project.destinations = [
		{
			accessible: true,
			category: 'Learning',
			description: 'Collections, study spaces, and visitor services.',
			floor: 'level-0',
			hours: '08:00-20:00',
			id: 'destination-library',
			logoAssetId: 'logo-library',
			mapNumber: 'L01',
			name: 'Campus Library',
			phone: '+1 555 0100',
			photoAssetIds: ['photo-library'],
			routeable: true,
			status: 'open',
			translations: {
				en: { description: 'Collections and study spaces.', name: 'Campus Library' },
				hu: { description: 'Gyujtemenyek es tanuloter.', name: 'Egyetemi konyvtar' }
			},
			website: 'https://example.test/library'
		},
		{
			accessible: true,
			category: 'Dining',
			floor: 'level-1',
			id: 'destination-cafe',
			name: 'Sky Cafe',
			routeable: true,
			translations: {
				en: { name: 'Sky Cafe' },
				hu: { name: 'Emeleti kavezo' }
			}
		}
	];
	level0.backgroundAssetId = 'background-level-0';
	level0.camera3d = {
		azimuthDegrees: 28,
		distance: 2100,
		pitchDegrees: 46,
		targetX: 960,
		targetY: 540
	};
	level0.unitsPerMeter = 20;
	level0.elements = [
		{
			destinationId: 'destination-library',
			floorId: 'level-0',
			geometry: [
				{ x: 120, y: 120 },
				{ x: 520, y: 120 },
				{ x: 520, y: 440 },
				{ x: 120, y: 440 }
			],
			id: 'location-library',
			label: 'Campus Library',
			presentation: { extrusionHeight: 26, fillColor: '#a9c6e8', fillOpacity: 0.78 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			floorId: 'level-0',
			geometry: [
				{ x: 60, y: 480 },
				{ x: 1860, y: 480 },
				{ x: 1860, y: 650 },
				{ x: 60, y: 650 }
			],
			id: 'walkable-main',
			presentation: { extrusionHeight: 0, fillColor: '#55bfa7', fillOpacity: 0.24 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			floorId: 'level-0',
			geometry: [
				{ x: 850, y: 500 },
				{ x: 1050, y: 500 },
				{ x: 1050, y: 630 },
				{ x: 850, y: 630 }
			],
			id: 'obstacle-atrium',
			provenance: 'customer-source',
			status: 'confirmed',
			type: 'obstacle'
		},
		{
			angle: 90,
			floorId: 'level-0',
			id: 'door-library',
			length: 34,
			locationId: 'location-library',
			point: { x: 320, y: 440 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		},
		{
			category: 'Services',
			floorId: 'level-0',
			id: 'poi-information',
			label: 'Information',
			point: { x: 680, y: 560 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'poi'
		},
		{
			defaultLanguage: 'hu',
			facingDegrees: 180,
			floorId: 'level-0',
			id: 'origin-lobby',
			label: 'Main lobby kiosk',
			point: { x: 1500, y: 565 },
			provenance: 'reviewer-authored',
			screenId: 'screen-lobby-01',
			status: 'confirmed',
			type: 'origin'
		},
		{
			accessible: true,
			connectionId: 'lift-a',
			floorId: 'level-0',
			id: 'transition-lift-a-level-0',
			kind: 'elevator',
			label: 'Lift A',
			point: { x: 1180, y: 560 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'transition'
		},
		{
			color: '#152f39',
			floorId: 'level-0',
			fontFamily: 'sans-serif',
			fontSize: 32,
			fontWeight: 700,
			id: 'label-library',
			outlineColor: '#ffffff',
			outlineWidth: 2,
			point: { x: 320, y: 240 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			text: 'LIBRARY',
			textAnchor: 'middle',
			type: 'label'
		},
		{
			assetId: 'logo-library',
			destinationId: 'destination-library',
			floorId: 'level-0',
			height: 60,
			id: 'logo-library-map',
			point: { x: 230, y: 300 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'logo',
			width: 120
		}
	];
	project.floors.push({
		elements: [
			{
				destinationId: 'destination-cafe',
				floorId: 'level-1',
				geometry: [
					{ x: 300, y: 180 },
					{ x: 780, y: 180 },
					{ x: 780, y: 500 },
					{ x: 300, y: 500 }
				],
				id: 'location-cafe',
				label: 'Sky Cafe',
				provenance: 'reviewer-authored',
				status: 'confirmed',
				type: 'location'
			},
			{
				accessible: true,
				connectionId: 'lift-a',
				floorId: 'level-1',
				id: 'transition-lift-a-level-1',
				kind: 'elevator',
				label: 'Lift A',
				point: { x: 1180, y: 560 },
				provenance: 'reviewer-authored',
				status: 'confirmed',
				type: 'transition'
			},
			{
				assetId: 'icon-cafe',
				destinationId: 'destination-cafe',
				floorId: 'level-1',
				height: 72,
				id: 'icon-cafe-map',
				point: { x: 460, y: 300 },
				provenance: 'reviewer-authored',
				status: 'confirmed',
				type: 'icon',
				width: 72
			}
		],
		height: 1080,
		id: 'level-1',
		name: 'Level 1',
		order: 1,
		unitsPerMeter: 20,
		width: 1920
	});
	project.graph = {
		edges: [
			{
				accessible: true,
				bidirectional: true,
				corridorWidth: 160,
				from: 'node-origin',
				geometry: [{ x: 1500, y: 565 }, { x: 1180, y: 565 }],
				id: 'edge-origin-lift',
				kind: 'walk',
				reviewStatus: 'confirmed',
				to: 'node-lift-0',
				traversal: 'indoor-corridor'
			},
			{
				accessible: true,
				bidirectional: true,
				from: 'node-lift-0',
				id: 'edge-lift-transition',
				kind: 'elevator',
				reviewStatus: 'confirmed',
				to: 'node-lift-1',
				traversal: 'transition'
			},
			{
				accessible: true,
				bidirectional: true,
				from: 'node-lift-1',
				geometry: [{ x: 1180, y: 560 }, { x: 540, y: 500 }, { x: 540, y: 340 }],
				id: 'edge-lift-cafe',
				kind: 'walk',
				reviewStatus: 'confirmed',
				to: 'node-cafe',
				traversal: 'indoor-corridor'
			}
		],
		graphId: 'roundtrip-campus-graph',
		nodes: [
			{
				id: 'node-origin',
				kind: 'route',
				levelId: 'level-0',
				semanticElementId: 'origin-lobby',
				x: 1500,
				y: 565
			},
			{
				id: 'node-lift-0',
				kind: 'transition',
				levelId: 'level-0',
				semanticElementId: 'transition-lift-a-level-0',
				x: 1180,
				y: 560
			},
			{
				id: 'node-lift-1',
				kind: 'transition',
				levelId: 'level-1',
				semanticElementId: 'transition-lift-a-level-1',
				x: 1180,
				y: 560
			},
			{
				id: 'node-cafe',
				kind: 'location',
				levelId: 'level-1',
				locationId: 'destination-cafe',
				semanticElementId: 'location-cafe',
				x: 540,
				y: 340
			}
		]
	};

	return project;
};

void test('a complex authored project survives a complete file round trip without semantic loss', (): void => {
	const source = buildComplexProject();
	assert.deepEqual(
		validateWayfindingStudioProject(source).filter((issue): boolean => issue.severity === 'error'),
		[]
	);

	const serialized = JSON.stringify(source);
	const repaired = repairWayfindingStudioProject(JSON.parse(serialized));
	const reopened = parseWayfindingStudioProject(repaired.project);

	assert.deepEqual(repaired.repairs, []);
	assert.deepEqual(reopened, source);
	assert.equal(reopened.floors.length, 2);
	assert.equal(reopened.floors.flatMap((floor) => floor.elements).length, 12);
	assert.equal(reopened.graph.edges.length, 3);
	assert.equal(reopened.destinations[0]?.translations?.hu?.name, 'Egyetemi konyvtar');
	assert.deepEqual(reopened.destinations[0]?.photoAssetIds, ['photo-library']);
	assert.equal(reopened.defaults?.route.animation, 'flow');
});
