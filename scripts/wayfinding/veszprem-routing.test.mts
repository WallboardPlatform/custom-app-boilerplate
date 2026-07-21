import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

import type { WayfindingGraphDocument, WayfindingNode, WayfindingRoutePoint, WayfindingWalkableMaskDocument } from '../../src/utils/wayfinding.js';
import { WayfindingGraph } from '../../src/utils/wayfinding.js';
import { parseDestinationMetadata, parseWayfindingSvg } from './model.mjs';
import { validateWayfinding } from './validation.mjs';

const exampleDirectory = path.resolve('examples', 'veszprem-wayfinding');
const graph = JSON.parse(fs.readFileSync(path.join(exampleDirectory, 'overlay', 'src', 'assets', 'route-graph.json'), 'utf8')) as WayfindingGraphDocument;
const mask = JSON.parse(fs.readFileSync(path.join(exampleDirectory, 'overlay', 'src', 'assets', 'walkable-mask.json'), 'utf8')) as WayfindingWalkableMaskDocument;
const map = parseWayfindingSvg(fs.readFileSync(path.join(exampleDirectory, 'overlay', 'src', 'assets', 'map.svg'), 'utf8'));
const destinations = parseDestinationMetadata(JSON.parse(fs.readFileSync(path.join(exampleDirectory, 'sample-destinations-datasource.json'), 'utf8')));
const routeGraph = new WayfindingGraph(graph);
const locationNodeById = new Map(graph.nodes.filter((node: WayfindingNode): boolean => node.kind === 'location')
	.map((node: WayfindingNode): [string, WayfindingNode] => [node.locationId!, node]));

const routeEdges = (destinationId: string): string[] => {
	const start = locationNodeById.get('tourinform-veszprem');
	const destination = locationNodeById.get(destinationId);

	assert.ok(start, 'The configured Veszprem start location must exist.');
	assert.ok(destination, `Missing route node for ${destinationId}.`);

	return routeGraph.route(start.id, destination.id)?.edgeIds ?? [];
};

const routePath = (destinationId: string): WayfindingRoutePoint[] => {
	const start = locationNodeById.get('tourinform-veszprem');
	const destination = locationNodeById.get(destinationId);

	assert.ok(start, 'The configured Veszprem start location must exist.');
	assert.ok(destination, `Missing route node for ${destinationId}.`);

	return routeGraph.route(start.id, destination.id)?.path ?? [];
};

const segmentIntersectsRectangle = (
	from: WayfindingRoutePoint,
	to: WayfindingRoutePoint,
	rectangle: { bottom: number; left: number; right: number; top: number }
): boolean => {
	const samples = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 2));

	for (let index = 0; index <= samples; index += 1) {
		const ratio = index / samples;
		const x = from.x + (to.x - from.x) * ratio;
		const y = from.y + (to.y - from.y) * ratio;

		if (x >= rectangle.left && x <= rectangle.right && y >= rectangle.top && y <= rectangle.bottom) return true;
	}

	return false;
};

void describe('Veszprem reviewed route topology', (): void => {
	void it('keeps every destination entrance as a leaf node', (): void => {
		const degree = new Map(graph.nodes.map((node: WayfindingNode): [string, number] => [node.id, 0]));

		for (const edge of graph.edges) {
			degree.set(edge.from, (degree.get(edge.from) ?? 0) + 1);
			degree.set(edge.to, (degree.get(edge.to) ?? 0) + 1);
		}

		for (const node of graph.nodes.filter((candidate: WayfindingNode): boolean => candidate.kind === 'location')) {
			assert.equal(degree.get(node.id), 1, `${node.id} must be an entrance leaf, not a transit shortcut.`);
		}
	});

	void it('uses the reviewed side of the central destinations', (): void => {
		assert.deepEqual(routeEdges('hosok-kapuja'), [
			'route-tourinform-egress',
			'route-old-town-west',
			'route-castle-entry',
			'route-heroes-approach',
			'approach-hosok-kapuja'
		]);
		assert.equal(routeEdges('auer-haz').at(-1), 'approach-auer-haz');
		assert.equal(routeEdges('posa-haz').at(-1), 'approach-posa-haz');
	});

	void it('requires the named crossings, stairs, and reviewed regional branches', (): void => {
		assert.ok(routeEdges('code-digitalis-elmenykozpont').includes('route-code-approach'));
		assert.ok(routeEdges('petofi-szinhaz').includes('crossing-ovari-east'));
		assert.ok(routeEdges('ruttner-haz-varborton').includes('stairs-jokai-ruttner'));
		assert.ok(routeEdges('benedek-hegy').includes('stairs-castle-north'));
		assert.ok(routeEdges('bakonyi-haz').includes('route-park-southeast'));
		assert.deepEqual(routeEdges('gyarkert-kulturpark').slice(-6), [
			'route-east-road-mid',
			'route-east-road-jutasi',
			'route-east-road-budapest',
			'route-east-road-gyarkert',
			'route-gyarkert-approach',
			'approach-gyarkert-kulturpark'
		]);
	});

	void it('keeps the far-east route north of the Digital Knowledge Centre footprint', (): void => {
		const path = routePath('gyarkert-kulturpark');
		const stripedBuilding = { bottom: 475, left: 535, right: 625, top: 380 };

		for (let index = 1; index < path.length; index += 1) {
			assert.equal(
				segmentIntersectsRectangle(path[index - 1], path[index], stripedBuilding),
				false,
				`Gyarkert segment ${index - 1} crosses the striped Digital Knowledge Centre footprint.`
			);
		}
	});

	void it('passes the graph, corridor-envelope, and complete route audit', (): void => {
		const report = validateWayfinding({
			destinations,
			graph,
			map,
			startLocationId: 'tourinform-veszprem',
			walkableMask: mask
		});

		assert.equal(report.summary.errors, 0, report.issues.filter((issue): boolean => issue.severity === 'error').map((issue): string => issue.message).join('\n'));
		assert.equal(report.summary.routesReachable, report.summary.routeableDestinations);
		assert.ok(!report.issues.some((issue): boolean => issue.code === 'edge-backtracking-review'));
	});
});
