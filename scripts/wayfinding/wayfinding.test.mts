import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { WayfindingGraphDocument } from '../../src/utils/wayfinding.js';
import { createLegacyProximityGraph, WayfindingGraph } from '../../src/utils/wayfinding.js';
import { synchronizeSvgPoints } from './compiler.mjs';
import { parseDestinationMetadata, parseWayfindingSvg } from './model.mjs';
import { createDebugSvg, writeWayfindingReport } from './report.mjs';
import { parseRouteGraph } from './schema.mjs';
import { validateWayfinding } from './validation.mjs';

const fixtureDirectory = path.resolve('scripts', 'wayfinding', 'fixtures');
const sourceSvg = fs.readFileSync(path.join(fixtureDirectory, 'valid-map.svg'), 'utf8');
const graph = JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'valid-route-graph.json'), 'utf8')) as WayfindingGraphDocument;
const destinations = parseDestinationMetadata(JSON.parse(fs.readFileSync(path.join(fixtureDirectory, 'valid-destinations.json'), 'utf8')));

void describe('wayfinding authoring foundation', (): void => {
	void it('parses the required layer structure and both legacy point naming conventions', (): void => {
		const map = parseWayfindingSvg(sourceSvg);

		assert.equal(map.levels.length, 1);
		assert.deepEqual(map.levels[0].subgroupIds, [
			'Level0-TransitionPoints',
			'Level0-LocationPoints',
			'Level0-RoutePoints',
			'Level0-Icons',
			'Level0-Legends',
			'Level0-Locations',
			'Level0-Walls'
		]);
		assert.deepEqual(map.levels[0].pointNodes.filter((node): boolean => node.kind === 'location').map((node): string | undefined => node.locationId), ['lobby', 'gallery']);
	});

	void it('accepts a synchronized explicit graph and proves route coverage', (): void => {
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

	void it('rejects malformed route graphs before synchronization or validation', (): void => {
		assert.throws(
			(): void => { parseRouteGraph(JSON.stringify({ ...graph, edges: [{ id: 'broken', from: 'lobby-lp' }] })); },
			/Route graph schema validation failed/
		);
	});

	void it('rejects transforms and disconnected routeable destinations', (): void => {
		const disconnected: WayfindingGraphDocument = {
			...graph,
			edges: graph.edges.slice(0, 2)
		};
		const report = validateWayfinding({
			destinations,
			graph: disconnected,
			map: parseWayfindingSvg(sourceSvg.replace('<g id="Level0">', '<g id="Level0" transform="translate(1 1)">')),
			startLocationId: 'lobby'
		});

		assert.ok(report.issues.some((issue): boolean => issue.code === 'transform-forbidden' && issue.severity === 'error'));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'destination-unreachable' && issue.references.includes('gallery')));
	});

	void it('keeps step-free coverage unknown for inferred legacy topology', (): void => {
		const map = parseWayfindingSvg(sourceSvg);
		const legacyGraph = createLegacyProximityGraph('legacy-fixture', map.levels[0].pointNodes, 400);
		const report = validateWayfinding({ destinations, graph: legacyGraph, map, startLocationId: 'lobby' });

		assert.ok(report.issues.some((issue): boolean => issue.code === 'legacy-accessibility-unverified'));
		assert.ok(report.routes.every((route): boolean => route.stepFreeReachable === null));
	});

	void it('rejects executable SVG content instead of trusting authoring input', (): void => {
		const unsafeSvg: string = sourceSvg.replace(
			'<g id="Base">',
			'<g id="Base"><script>alert(1)</script><rect id="unsafe-link" onclick="alert(1)"/>'
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
			generation: { mode: 'explicit' },
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
		const multiLevelSvg: string = synchronizeSvgPoints(
			sourceSvg.replace('</svg>', '<g id="Level1"><g id="Level1-TransitionPoints"/><g id="Level1-LocationPoints"/><g id="Level1-RoutePoints"/><g id="Level1-Icons"/><g id="Level1-Legends"/><g id="Level1-Locations"/><g id="Level1-Walls"/></g></svg>'),
			multiLevelGraph
		);
		const report = validateWayfinding({ destinations, graph: multiLevelGraph, map: parseWayfindingSvg(multiLevelSvg), startLocationId: 'lobby' });

		assert.ok(report.issues.some((issue): boolean => issue.code === 'cross-level-distance-missing'));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'cross-level-transition-node-required'));
		assert.ok(report.issues.some((issue): boolean => issue.code === 'cross-level-edge-kind-invalid'));
	});

	void it('writes a self-contained report with the graph overlay', (): void => {
		const directory: string = fs.mkdtempSync(path.join(os.tmpdir(), 'wb-wayfinding-'));
		const report = validateWayfinding({ destinations, graph, map: parseWayfindingSvg(sourceSvg), startLocationId: 'lobby' });

		writeWayfindingReport(directory, sourceSvg, graph, report);

		assert.ok(fs.readFileSync(path.join(directory, 'wayfinding-debug.svg'), 'utf8').includes('wb-wayfinding-route-highlight'));
		assert.ok(fs.readFileSync(path.join(directory, 'index.html'), 'utf8').includes('Route coverage'));
		assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'wayfinding-report.json'), 'utf8')).summary.errors, 0);
	});

	void it('synchronizes canonical graph nodes into legacy SVG point groups', (): void => {
		const staleSvg: string = sourceSvg.replace('cx="320" cy="360"', 'cx="999" cy="999"');
		const synchronized = synchronizeSvgPoints(staleSvg, graph);
		const map = parseWayfindingSvg(synchronized);
		const west = map.levels[0].pointNodes.find((node): boolean => node.id === 'rp-west');

		assert.deepEqual(west && { x: west.x, y: west.y }, { x: 320, y: 360 });
		assert.equal(map.levels[0].pointNodes.find((node): boolean => node.id === 'gallery-lp')?.locationId, 'gallery');
	});
});
