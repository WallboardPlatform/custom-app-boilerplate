import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWayfindingMapPackage } from './runtime-package.mjs';
import { parseWayfindingStudioProject } from './studio-project.mjs';

const scriptDirectory: string = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory: string = path.resolve(scriptDirectory, '..', '..');
const sourcePath: string = path.join(
	rootDirectory,
	'examples',
	'spatial-wayfinding',
	'source',
	'campus.wbwayfinding'
);
const outputPath: string = path.join(
	rootDirectory,
	'examples',
	'spatial-wayfinding',
	'overlay',
	'src',
	'assets',
	'campus.wbmap'
);

const project = parseWayfindingStudioProject(JSON.parse(fs.readFileSync(sourcePath, 'utf8')));

fs.writeFileSync(outputPath, createWayfindingMapPackage(project));
process.stdout.write(
	`Published ${path.relative(rootDirectory, outputPath)} from ${path.relative(rootDirectory, sourcePath)}\n`
);
