/* eslint-disable no-console -- CLI status is the command's user-facing output. */
import fs from 'node:fs';
import path from 'node:path';

import type { WayfindingGraphDocument, WayfindingWalkableMaskDocument } from '../../src/utils/wayfinding.js';
import { parseDestinationMetadata, parseWayfindingSvg } from './model.mjs';
import { writeWayfindingReport } from './report.mjs';
import { parseRouteGraph, parseWalkableMask } from './schema.mjs';
import { validateWayfinding } from './validation.mjs';

const argument = (name: string): string | undefined => {
	const index: number = process.argv.indexOf(`--${name}`);

	return index >= 0 ? process.argv[index + 1] : undefined;
};

const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);

const requirePath = (name: string): string => {
	const value: string | undefined = argument(name);

	if (!value) throw new Error(`Missing required --${name} argument.`);

	const absolutePath: string = path.resolve(value);

	if (!fs.existsSync(absolutePath)) throw new Error(`File '${absolutePath}' does not exist.`);

	return absolutePath;
};

const readJson = (filePath: string): unknown => {
	return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')) as unknown;
};

if (hasFlag('help')) {
	console.log('Usage: npm run wayfinding:validate -- --svg <map.svg> --graph <route-graph.json> --destinations <sample.json> --start <location-id> [--walkable-mask <mask.json>] [--route-to <location-id>] [--report-dir <directory>] [--strict]');
	process.exit(0);
}

const svgPath: string = requirePath('svg');
const destinationPath: string = requirePath('destinations');
const sourceSvg: string = fs.readFileSync(svgPath, 'utf8');
const map = parseWayfindingSvg(sourceSvg);
const destinations = parseDestinationMetadata(readJson(destinationPath));
const graphPath: string = requirePath('graph');
const graph: WayfindingGraphDocument = parseRouteGraph(fs.readFileSync(graphPath, 'utf8'));
const walkableMaskPath: string | undefined = argument('walkable-mask');
const walkableMask: WayfindingWalkableMaskDocument | undefined = walkableMaskPath
	? parseWalkableMask(fs.readFileSync(path.resolve(walkableMaskPath), 'utf8'))
	: undefined;

const report = validateWayfinding({
	destinations,
	graph,
	highlightDestinationId: argument('route-to'),
	map,
	startLocationId: argument('start'),
	walkableMask
});
const reportDirectory: string = path.resolve(argument('report-dir') ?? path.join(path.dirname(svgPath), 'wayfinding-report'));
writeWayfindingReport(reportDirectory, sourceSvg, graph, report);

console.log(`Wayfinding report: ${path.join(reportDirectory, 'index.html')}`);
console.log(`Map ${report.map.width}x${report.map.height}; ${report.map.levels} level(s), ${report.map.locations} location(s).`);
console.log(`Graph ${report.graph.nodes} nodes, ${report.graph.edges} edges, max degree ${report.graph.maxDegree}.`);
console.log(`Routes ${report.summary.routesReachable}/${report.summary.routeableDestinations}; ${report.summary.errors} error(s), ${report.summary.warnings} warning(s).`);

if (report.summary.errors > 0 || (hasFlag('strict') && report.summary.warnings > 0)) process.exitCode = 1;
