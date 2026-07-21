import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { WayfindingGraphDocument, WayfindingWalkableMaskDocument } from '../../src/utils/wayfinding.js';
import { WayfindingGraph } from '../../src/utils/wayfinding.js';
import { parseDestinationMetadata, parseWayfindingSvg } from './model.mjs';
import { createDebugSvg, writeWayfindingReport } from './report.mjs';
import { parseRouteGraph, parseWalkableMask } from './schema.mjs';
import { validateWayfinding } from './validation.mjs';

const fixtureDirectory = path.resolve('scripts', 'wayfinding', 'fixtures');
const sourceSvg = fs.readFileSync(path.join(fixtureDirectory, 'valid-map.svg'), 'utf8');
const graph = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'valid-route-graph.json'), 'utf8')) as WayfindingGraphDocument;
const destinations = parseDestinationMetadata(JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'valid-destinations.json'), 'utf8')));

void describe('wayfinding authoring foundation', (): void => {
	void it('accepts native location annotations, arbitrary visual structure, transforms, and coordinate size', (): void => {
		const map = parseWayfindingSvg(sourceSvg);

		assert.deepEqual(map.locations.map((location): string => location.locationId), ['lobby', 'gallery']);
		assert.deepEqual(map.locations.map((location): string | undefined => location.levelId), ['ground', 'ground']);
		assert.deepEqual({ width: map.width, height: map.height }, { width: 800, height: 450 });
	});

	void it('accepts an independent explicit graph and proves route coverage', (): void => {
		const report = validateWayfinding({
			destinations,
			graph,
			map: parseWayfindingSvg(sourceSvg),
			startLocationId: 'lobby'
		});

		assert.equal(report.summary.errors, 0);
		assert.equal(report.summary.warnings, 0);
		assert.equal(report.summary.routesReachable, 2);
		assert.equal(report.graph.maxDegree, 2);
		assert.deepEqual(report.routes.find((route): boolean => route.destinationId === 'gallery')?.nodeIds, ['lp-lobby', 'rp-west', 'rp-east', 'gallery-lp']);
	});

	void it('allows listed-only destinations without invented map geometry', (): void => {
		const report = validateWayfinding({
			destinations: [...destinations, {
				accessible: null,
				category: 'External',
				description: '',
				hours: '',
				id: 'off-site-museum',
				name: 'Off-site museum',
				routeable: false,
				status: ''
			}],
			graph,
			map: parseWayfindingSvg(sourceSvg),
			startLocationId: 'lobby'
		});

		assert.ok(!report.issues.some((issue): boolean => issue.code === 'destination-location-missing' && issue.references?.includes('off-site-museum')));
	});

	void it('rejects location nodes used as transit shortcuts', (): void => {
		const transitGraph: WayfindingGraphDocument = {
			...graph,
			edges: [
				...graph.edges,
				{ id: 'gallery-to-finish', from: 'gallery-lp', to: 'finish-lp', kind: 'walk', accessible: true, bidirectional: true, distanceMeters: 10 }
			],
			nodes: [...graph.nodes, { id: 'finish-lp', kind: 'location', levelId: 'ground', locationId: 'finish', x: 720, y: 225 }]
		};
		const report = validateWayfinding({
			destinations: [...destinations, { accessible: null, category: '', description: '', hours: '', id: 'finish', name: 'Finish', routeable: true, status: '' }],
			graph: transitGraph,
			map: parseWayfindingSvg(sourceSvg),
			startLocationId: 'lobby'
		});

		assert.ok(report.issues.some((issue): boolean => issue.code === 'location-node-used-as-transit' && issue.references.includes('gallery-lp')));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'route-uses-unrelated-location'));
	});

	void it('flags backtracking geometry produced by noisy route tracing', (): void => {
		const zigzagGraph: WayfindingGraphDocument = {
			contractVersion: 2,
			edges: [{
				accessible: true,
				bidirectional: true,
				corridorWidth: 18,
				from: 'lp-lobby',
				geometry: [{ x: 120, y: 225 }, { x: 260, y: 225 }, { x: 150, y: 230 }, { x: 680, y: 225 }],
				id: 'noisy-trace',
				kind: 'walk',
				reviewStatus: 'confirmed',
				to: 'gallery-lp',
				traversal: 'indoor-corridor'
			}],
			graphId: 'noisy-trace',
			nodes: graph.nodes
		};
		const report = validateWayfinding({ destinations, graph: zigzagGraph, map: parseWayfindingSvg(sourceSvg), startLocationId: 'lobby' });

		assert.ok(report.issues.some((issue): boolean => issue.code === 'edge-backtracking-review'));
	});

	void it('routes and measures version 2 edges through their reviewed centerline geometry', (): void => {
		const curvedGraph: WayfindingGraphDocument = {
			contractVersion: 2,
			edges: [{
				accessible: true,
				bidirectional: true,
				corridorWidth: 18,
				from: 'start',
				geometry: [{ x: 100, y: 100 }, { x: 200, y: 160 }, { x: 300, y: 100 }],
				id: 'curved-corridor',
				kind: 'outdoor',
				reviewStatus: 'confirmed',
				to: 'finish',
				traversal: 'outdoor-path'
			}],
			graphId: 'curved-corridor',
			nodes: [
				{ id: 'start', kind: 'location', levelId: 'ground', locationId: 'lobby', x: 100, y: 100 },
				{ id: 'finish', kind: 'location', levelId: 'ground', locationId: 'gallery', x: 300, y: 100 }
			]
		};
		const routeGraph = new WayfindingGraph(parseRouteGraph(JSON.stringify(curvedGraph)));
		const forward = routeGraph.route('start', 'finish', { mapRatio: 1 });
		const reverse = routeGraph.route('finish', 'start', { mapRatio: 1 });

		assert.deepEqual(forward?.path, [
			{ levelId: 'ground', x: 100, y: 100 },
			{ levelId: 'ground', x: 200, y: 160 },
			{ levelId: 'ground', x: 300, y: 100 }
		]);
		assert.deepEqual(reverse?.path, [...(forward?.path ?? [])].reverse());
		assert.ok((forward?.distancePixels ?? 0) > 200);
	});

	void it('rejects unreviewed or malformed version 2 corridor geometry', (): void => {
		const invalidGraph: WayfindingGraphDocument = {
			contractVersion: 2,
			edges: [{
				accessible: true,
				bidirectional: true,
				from: 'lp-lobby',
				geometry: [{ x: 130, y: 225 }, { x: 540, y: 225 }],
				id: 'unreviewed-corridor',
				kind: 'walk',
				reviewStatus: 'proposed',
				to: 'rp-east',
				traversal: 'indoor-corridor'
			}],
			graphId: 'invalid-corridor',
			nodes: graph.nodes
		};
		const report = validateWayfinding({ destinations, graph: invalidGraph, map: parseWayfindingSvg(sourceSvg), startLocationId: 'lobby' });

		assert.ok(report.issues.some((issue): boolean => issue.code === 'edge-geometry-start-mismatch'));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'edge-corridor-width-required'));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'edge-review-required'));
	});

	void it('rejects a connected route that leaves the independently confirmed walkable mask', (): void => {
		const mask: WayfindingWalkableMaskDocument = parseWalkableMask(JSON.stringify({
			cellSize: 25,
			columns: 32,
			contractVersion: 1,
			height: 450,
			mapId: 'fixture-ground-floor',
			reviewStatus: 'confirmed',
			rows: 18,
			walkableRuns: [[8, 0, 31], [9, 0, 31], [10, 0, 31]],
			width: 800
		}));
		const shortcutGraph: WayfindingGraphDocument = {
			contractVersion: 2,
			edges: [{
				accessible: true,
				bidirectional: true,
				corridorWidth: 20,
				from: 'lp-lobby',
				geometry: [{ x: 120, y: 225 }, { x: 400, y: 100 }, { x: 680, y: 225 }],
				id: 'invalid-shortcut',
				kind: 'walk',
				reviewStatus: 'confirmed',
				to: 'gallery-lp',
				traversal: 'indoor-corridor'
			}],
			graphId: 'invalid-shortcut',
			nodes: graph.nodes
		};
		const report = validateWayfinding({
			destinations,
			graph: shortcutGraph,
			map: parseWayfindingSvg(sourceSvg),
			startLocationId: 'lobby',
			walkableMask: mask
		});

		assert.ok(report.issues.some((issue): boolean => issue.code === 'edge-outside-walkable-space'));
	});

	void it('accepts reviewed centerline geometry contained by a confirmed walkable mask', (): void => {
		const mask: WayfindingWalkableMaskDocument = parseWalkableMask(JSON.stringify({
			cellSize: 25,
			columns: 32,
			contractVersion: 1,
			height: 450,
			mapId: 'fixture-ground-floor',
			reviewStatus: 'confirmed',
			rows: 18,
			walkableRuns: [[8, 0, 31], [9, 0, 31], [10, 0, 31]],
			width: 800
		}));
		const reviewedGraph: WayfindingGraphDocument = {
			contractVersion: 2,
			edges: graph.edges.map((edge) => {
				const from = graph.nodes.find((node): boolean => node.id === edge.from)!;
				const to = graph.nodes.find((node): boolean => node.id === edge.to)!;

				return {
					...edge,
					corridorWidth: 20,
					geometry: [{ x: from.x, y: from.y }, { x: to.x, y: to.y }],
					reviewStatus: 'confirmed' as const,
					traversal: 'indoor-corridor' as const
				};
			}),
			graphId: graph.graphId,
			nodes: graph.nodes
		};
		const report = validateWayfinding({
			destinations,
			graph: reviewedGraph,
			map: parseWayfindingSvg(sourceSvg),
			startLocationId: 'lobby',
			walkableMask: mask
		});

		assert.ok(!report.issues.some((issue): boolean => issue.code === 'edge-outside-walkable-space'));
		assert.ok(!report.issues.some((issue): boolean => issue.code === 'walkable-mask-missing'));
	});

	void it('rejects malformed route graphs before validation', (): void => {
		assert.throws(
			(): void => { parseRouteGraph(JSON.stringify({ ...graph, edges: [{ id: 'broken', from: 'lobby-lp' }] })); },
			/Route graph schema validation failed/
		);
	});

	void it('keeps missing accessibility unknown and requires review', (): void => {
		const unknownDestinations = parseDestinationMetadata([{ id: 'lobby', name: 'Lobby', routeable: true }]);
		const report = validateWayfinding({ destinations: unknownDestinations, graph, map: parseWayfindingSvg(sourceSvg), startLocationId: 'lobby' });

		assert.equal(unknownDestinations[0].accessible, null);
		assert.ok(report.issues.some((issue): boolean => issue.code === 'destination-accessibility-unverified'));
	});

	void it('allows SVG transforms but rejects disconnected routeable destinations', (): void => {
		const disconnected: WayfindingGraphDocument = {
			...graph,
			edges: graph.edges.slice(0, 2)
		};
		const report = validateWayfinding({
			destinations,
			graph: disconnected,
			map: parseWayfindingSvg(sourceSvg),
			startLocationId: 'lobby'
		});

		assert.ok(!report.issues.some((issue): boolean => issue.code === 'transform-forbidden'));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'destination-unreachable' && issue.references.includes('gallery')));
	});

	void it('rejects executable SVG content instead of trusting authoring input', (): void => {
		const unsafeSvg: string = sourceSvg.replace(
			'<rect id="map-background"',
			'<script>alert(1)</script><rect id="unsafe-link" onclick="alert(1)"/><rect id="map-background"'
		);
		const report = validateWayfinding({ destinations, graph, map: parseWayfindingSvg(unsafeSvg), startLocationId: 'lobby' });

		assert.ok(report.issues.some((issue): boolean => issue.code === 'executable-svg-content'));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'svg-event-handler'));
		assert.doesNotMatch(createDebugSvg(unsafeSvg, graph), /<script|onclick=/i);
	});

	void it('selects a longer elevator route for step-free navigation', (): void => {
		const accessibleGraph: WayfindingGraphDocument = {
			contractVersion: 1,
			edges: [
				{ id: 'direct-stairs', from: 'start', to: 'finish', kind: 'stairs', accessible: false, bidirectional: true, distanceMeters: 5 },
				{ id: 'to-elevator', from: 'start', to: 'lift', kind: 'walk', accessible: true, bidirectional: true, distanceMeters: 8 },
				{ id: 'from-elevator', from: 'lift', to: 'finish', kind: 'elevator', accessible: true, bidirectional: true, distanceMeters: 8 }
			],
			graphId: 'accessible-choice',
			nodes: [
				{ id: 'start', levelId: 'Level0', kind: 'location', locationId: 'start', x: 0, y: 0 },
				{ id: 'lift', levelId: 'Level0', kind: 'transition', x: 0, y: 10 },
				{ id: 'finish', levelId: 'Level0', kind: 'location', locationId: 'finish', x: 10, y: 0 }
			]
		};
		const routeGraph = new WayfindingGraph(accessibleGraph);

		assert.deepEqual(routeGraph.route('start', 'finish')?.edgeIds, ['direct-stairs']);
		assert.deepEqual(routeGraph.route('start', 'finish', { profile: 'step-free' })?.edgeIds, ['to-elevator', 'from-elevator']);
	});

	void it('requires physical distance for cross-level edges', (): void => {
		const multiLevelGraph: WayfindingGraphDocument = {
			...graph,
			edges: [{ ...graph.edges[0], distanceMeters: undefined, from: 'lp-lobby', id: 'cross-floor', to: 'gallery-lp' }],
			nodes: graph.nodes.map((node): typeof node => node.id === 'gallery-lp' ? { ...node, levelId: 'Level1' } : node)
		};
		const multiLevelSvg: string = sourceSvg.replace('data-wayfinding-location-id="gallery" data-wayfinding-level="ground"', 'data-wayfinding-location-id="gallery" data-wayfinding-level="Level1"');
		const report = validateWayfinding({ destinations, graph: multiLevelGraph, map: parseWayfindingSvg(multiLevelSvg), startLocationId: 'lobby' });

		assert.ok(report.issues.some((issue): boolean => issue.code === 'cross-level-distance-missing'));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'cross-level-transition-node-required'));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'cross-level-edge-kind-invalid'));
	});

	void it('accepts aligned transition points on adjacent levels', (): void => {
		const alignedTransitionGraph: WayfindingGraphDocument = {
			contractVersion: 2,
			edges: [{
				accessible: true,
				bidirectional: true,
				distanceMeters: 4,
				from: 'lift-ground',
				id: 'lift-ground-level-one',
				kind: 'elevator',
				reviewStatus: 'confirmed',
				to: 'lift-level-one',
				traversal: 'transition'
			}],
			graphId: 'aligned-transition',
			nodes: [
				{ id: 'lift-ground', kind: 'transition', levelId: 'ground', x: 400, y: 225 },
				{ id: 'lift-level-one', kind: 'transition', levelId: 'Level1', x: 400, y: 225 }
			]
		};
		const report = validateWayfinding({ destinations: [], graph: alignedTransitionGraph, map: parseWayfindingSvg(sourceSvg) });

		assert.ok(!report.issues.some((issue): boolean => issue.code === 'edge-geometry-zero-segment'));
	});

	void it('writes a self-contained report with the graph overlay', (): void => {
		const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-wayfinding-'));
		const report = validateWayfinding({ destinations, graph, map: parseWayfindingSvg(sourceSvg), startLocationId: 'lobby' });

		writeWayfindingReport(directory, sourceSvg, graph, report);

		assert.ok(fs.readFileSync(path.join(directory, 'wayfinding-debug.svg'), 'utf8').includes('wb-wayfinding-route-highlight'));
		assert.ok(fs.readFileSync(path.join(directory, 'index.html'), 'utf8').includes('Route coverage'));
		assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'wayfinding-report.json'), 'utf8')).summary.errors, 0);
	});
});
