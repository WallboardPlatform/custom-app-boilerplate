/* eslint-disable no-console -- CLI reports validated artifacts. */
import fs from 'node:fs';
import path from 'node:path';

import { parseWayfindingProject } from './schema.mjs';
import { validateConfiguredSourceFidelity } from './source-fidelity-project.mjs';

const index: number = process.argv.indexOf('--project');

if (index < 0 || !process.argv[index + 1]) {
	throw new Error('Usage: npm run wayfinding:validate-source-fidelity -- --project <wayfinding-project.json>');
}

const projectPath: string = path.resolve(process.argv[index + 1]);
const project = parseWayfindingProject(fs.readFileSync(projectPath, 'utf8'));

validateConfiguredSourceFidelity(path.dirname(projectPath), project);
console.log(`Wayfinding source fidelity valid: ${project.projectId}`);
