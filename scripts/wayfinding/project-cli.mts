/* eslint-disable no-console -- CLI output is the generated assessment. */
import fs from 'node:fs';
import path from 'node:path';

import { assessWayfindingProject } from './project.mjs';
import { parseWayfindingProject } from './schema.mjs';

const argument = (name: string): string | undefined => {
	const index: number = process.argv.indexOf(`--${name}`);

	return index >= 0 ? process.argv[index + 1] : undefined;
};

const projectArgument: string | undefined = argument('project');

if (!projectArgument) {
	console.log('Usage: npm run wayfinding:assess -- --project <wayfinding-project.json> [--output <assessment.json>]');
	process.exitCode = 1;
} else {
	const projectPath: string = path.resolve(projectArgument);
	const project = parseWayfindingProject(fs.readFileSync(projectPath, 'utf8'));
	const assessment = assessWayfindingProject(project);
	const serialized: string = `${JSON.stringify(assessment, null, 2)}\n`;
	const outputArgument: string | undefined = argument('output');

	if (outputArgument) {
		const outputPath: string = path.resolve(outputArgument);
		fs.mkdirSync(path.dirname(outputPath), { recursive: true });
		fs.writeFileSync(outputPath, serialized);
		console.log(`Wayfinding assessment: ${outputPath}`);
	}

	console.log(serialized.trimEnd());

	if (!assessment.deliveryAllowed) process.exitCode = 1;
}
