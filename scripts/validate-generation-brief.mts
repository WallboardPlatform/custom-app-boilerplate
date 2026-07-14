import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { materializeExample } from './example-materialization.mjs';
import {
	readJsonFile,
	type ProjectValidationContext,
	validateBriefAgainstProject
} from './generation-brief/project-validation.mts';
import { validateStandaloneBrief } from './generation-brief/validation.mts';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argumentsSet = new Set(process.argv.slice(2));
const selectedModes = ['--brief', '--project', '--examples'].filter((mode) => argumentsSet.has(mode));

if (selectedModes.length !== 1) {
	throw new Error('Use exactly one mode: --brief, --project, or --examples.');
}

const createProjectContext = (id: string, applicationDirectory: string): ProjectValidationContext => ({
	id,
	applicationDirectory,
	briefPath: path.join(applicationDirectory, 'generation-brief.json'),
	contractPath: path.join(applicationDirectory, 'datasource-contract.json'),
	fixturePath: path.join(applicationDirectory, 'preview', 'fixture.ts'),
	propertiesPath: path.join(applicationDirectory, 'src', 'editor-assets', 'properties.json')
});

const validateContext = async (context: ProjectValidationContext, synchronizeProject: boolean): Promise<void> => {
	const briefValue = readJsonFile(context, context.briefPath, 'generation brief');
	const brief = validateStandaloneBrief(briefValue, context.id);

	if (synchronizeProject) {
		await validateBriefAgainstProject(context, brief);
	}
};

if (selectedModes[0] === '--brief') {
	await validateContext(createProjectContext('generation-brief', rootDirectory), false);
	process.stdout.write('Validated generation brief plan.\n');
} else if (selectedModes[0] === '--project') {
	await validateContext(createProjectContext('materialized-project', rootDirectory), true);
	process.stdout.write('Validated generation brief against project artifacts.\n');
} else {
	const examplesDirectory = path.join(rootDirectory, 'examples');
	const validationDirectory = path.join(rootDirectory, '.tmp', 'brief-validation');
	let validatedExamples = 0;

	if (fs.existsSync(examplesDirectory)) {
		fs.rmSync(validationDirectory, { recursive: true, force: true });
		fs.mkdirSync(validationDirectory, { recursive: true });

		for (const entry of fs.readdirSync(examplesDirectory, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				continue;
			}

			const applicationDirectory = path.join(validationDirectory, entry.name);

			materializeExample({
				rootDirectory,
				exampleId: entry.name,
				targetDirectory: applicationDirectory
			});
			await validateContext(createProjectContext(entry.name, applicationDirectory), true);
			validatedExamples += 1;
		}
	}

	process.stdout.write(`Validated ${validatedExamples} generation brief(s) against example artifacts.\n`);
}
