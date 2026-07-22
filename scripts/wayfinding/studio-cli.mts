import fs from 'node:fs';
import path from 'node:path';

import { createWayfindingRuntimeBundle, validateWayfindingStudioDelivery } from './studio-project.mjs';
import { parseWayfindingStudioProjectSource } from './schema.mjs';

const argument = (name: string): string | undefined => {
	const index: number = process.argv.indexOf(`--${name}`);

return index >= 0 ? process.argv[index + 1] : undefined;
};

const projectPath: string | undefined = argument('project');
const outputDirectory: string | undefined = argument('output');

if (!projectPath) throw new Error('Usage: npm run wayfinding:studio:export -- --project <project.wbwayfinding> [--output <directory>]');

const project = parseWayfindingStudioProjectSource(fs.readFileSync(path.resolve(projectPath), 'utf8'));
const issues = validateWayfindingStudioDelivery(project);
const errors = issues.filter((issue): boolean => issue.severity === 'error');

if (errors.length > 0) {
	throw new Error(errors.map((issue): string => `${issue.code}: ${issue.message}`).join('\n'));
}

const bundle = createWayfindingRuntimeBundle(project);

if (!outputDirectory) {
	process.stdout.write(`${JSON.stringify({ issues, manifest: bundle.manifest }, null, 2)}\n`);
} else {
	const target: string = path.resolve(outputDirectory);
	fs.mkdirSync(path.join(target, 'floors'), { recursive: true });
	fs.writeFileSync(path.join(target, 'manifest.json'), `${JSON.stringify(bundle.manifest, null, 2)}\n`);
	fs.writeFileSync(path.join(target, 'route-graph.json'), `${JSON.stringify(bundle.graph, null, 2)}\n`);
	fs.writeFileSync(path.join(target, 'destinations-datasource.json'), `${JSON.stringify(bundle.destinations, null, 2)}\n`);

	for (const floor of bundle.floors) fs.writeFileSync(path.join(target, 'floors', `${floor.id}.svg`), `${floor.svg}\n`);
	fs.writeFileSync(path.join(target, 'validation.json'), `${JSON.stringify({ issues }, null, 2)}\n`);
	process.stdout.write(`Exported ${bundle.floors.length} floor(s) to ${target}\n`);
}
