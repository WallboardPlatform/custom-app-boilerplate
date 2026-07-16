import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectSourceFiles, createSourceArchive } from '../scripts/source-archive.mts';

interface BenchmarkTask {
	id: string;
	title: string;
	prompt: string;
	inputs: string[];
}

interface BenchmarkSet {
	benchmarkVersion: number;
	tasks: BenchmarkTask[];
}

const benchmarkDirectory: string = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory: string = path.dirname(benchmarkDirectory);
const argumentsList: string[] = process.argv.slice(2);
const runIdIndex: number = argumentsList.indexOf('--run-id');
const requestedRunId: string | undefined = runIdIndex >= 0 ? argumentsList[runIdIndex + 1] : undefined;
const runId: string = requestedRunId ?? new Date().toISOString().replace(/[:.]/g, '-');

if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/u.test(runId)) {
	throw new Error('Run id must contain only letters, numbers, dots, underscores, and hyphens.');
}

const runDirectory: string = path.join(repositoryDirectory, '.tmp', 'benchmark-runs', runId);

if (fs.existsSync(runDirectory)) {
	throw new Error(`Benchmark run '${runId}' already exists; first-pass evidence is immutable.`);
}

const benchmark: BenchmarkSet = JSON.parse(
	fs.readFileSync(path.join(benchmarkDirectory, 'benchmark-set.v1.json'), 'utf8')
) as BenchmarkSet;
const sourceFiles: string[] = collectSourceFiles(repositoryDirectory);
const sourceArchivePath: string = path.join(runDirectory, 'agent-ready-source.zip');

fs.mkdirSync(runDirectory, { recursive: true });
const sourceArchive = await createSourceArchive(repositoryDirectory, sourceArchivePath, runDirectory);
const rootNodeModules: string = path.join(repositoryDirectory, 'node_modules');

if (!fs.existsSync(rootNodeModules)) {
	throw new Error('Root node_modules is required to provision isolated benchmark workspaces.');
}

const manifestTasks: Array<Record<string, unknown>> = [];

for (const task of benchmark.tasks) {
	const workspace: string = path.join(runDirectory, 'workspaces', task.id);

	for (const relativePath of sourceFiles) {
		const sourcePath: string = path.join(repositoryDirectory, relativePath);
		const targetPath: string = path.join(workspace, relativePath);
		fs.mkdirSync(path.dirname(targetPath), { recursive: true });
		fs.copyFileSync(sourcePath, targetPath);
	}

	const inputDirectory: string = path.join(workspace, 'task-inputs');
	fs.mkdirSync(inputDirectory, { recursive: true });

	for (const input of task.inputs) {
		fs.copyFileSync(path.join(benchmarkDirectory, input), path.join(inputDirectory, path.basename(input)));
	}

	const taskPrompt = [
		'# Wallboard custom app request',
		'',
		task.prompt,
		'',
		'## Execution boundary',
		'',
		'- Work only inside this workspace and use its normal repository instructions and examples.',
		'- Declared reference files, when present, are under `task-inputs/`.',
		'- Dependencies are preinstalled; do not inspect parent or sibling directories.',
		'- Preserve the supplied scaffold and its package scripts, validators, preview harness, and delivery workflow; implement within it rather than replacing it.',
		'- Complete implementation, realistic preview scenarios, behavior tests, visual inspection, production packaging, and an upload-ready delivery.',
		'- Run `npm run deliver -- benchmark-delivery` as the final command and report the delivery path plus validation results.',
		'- Do not ask for benchmark criteria or evaluator context; none is needed to complete the user request.',
		''
	].join('\n');

	fs.writeFileSync(path.join(workspace, 'TASK.md'), taskPrompt, 'utf8');
	fs.symlinkSync(rootNodeModules, path.join(workspace, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
	manifestTasks.push({
		id: task.id,
		title: task.title,
		workspace,
		promptFile: path.join(workspace, 'TASK.md'),
		inputs: task.inputs.map((input: string): string => path.join(workspace, 'task-inputs', path.basename(input)))
	});
}

const manifest = {
	runId,
	benchmarkVersion: benchmark.benchmarkVersion,
	preparedAt: new Date().toISOString(),
	source: {
		archive: sourceArchivePath,
		sha256: sourceArchive.sha256,
		fileCount: sourceArchive.fileCount
	},
	environment: {
		dependencyProvisioning: 'junction to the validated runner node_modules; excluded from source and deliveries',
		generationContext: ['normal agent-ready source', 'TASK.md', 'declared task-inputs only']
	},
	tasks: manifestTasks
};

fs.writeFileSync(path.join(runDirectory, 'run-manifest.json'), `${JSON.stringify(manifest, null, '\t')}\n`, 'utf8');
console.log(`Prepared benchmark run '${runId}' at ${runDirectory}`);
console.log(`Agent-ready source: ${sourceArchive.fileCount} files, sha256 ${sourceArchive.sha256}`);
console.log(`Isolated workspaces: ${manifestTasks.length}`);
