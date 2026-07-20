/* eslint-disable no-console -- CLI status is the command's user-facing output. */
import fs from 'node:fs';
import path from 'node:path';

import { synchronizeSvgPoints } from './compiler.mjs';
import { parseWayfindingSvg } from './model.mjs';
import { parseRouteGraph } from './schema.mjs';

const argument = (name: string): string | undefined => {
	const index: number = process.argv.indexOf(`--${name}`);

	return index >= 0 ? process.argv[index + 1] : undefined;
};

const requiredArgument = (name: string): string => {
	const value: string | undefined = argument(name);

	if (!value) throw new Error(`Missing required --${name} argument.`);

	return path.resolve(value);
};

const svgPath: string = requiredArgument('svg');
const graphPath: string = requiredArgument('graph');
const outputPath: string = requiredArgument('out');
const sourceSvg: string = fs.readFileSync(svgPath, 'utf8');
const graph = parseRouteGraph(fs.readFileSync(graphPath, 'utf8'));
const synchronized: string = synchronizeSvgPoints(sourceSvg, graph);

parseWayfindingSvg(synchronized);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, synchronized, 'utf8');

console.log(`Synchronized SVG: ${outputPath}`);
