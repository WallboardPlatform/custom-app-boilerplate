import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { findAvailablePort } from '../scripts/playwright/free-port.mjs';
import { createSourceArchive } from '../scripts/source-archive.mts';
import { validateDatasourceGate, validateVersionOnePolicy } from './gate-inspection.mts';

interface RunTask {
	id: string;
	workspace: string;
}

interface RunManifest {
	runId: string;
	tasks: RunTask[];
}

interface CommandResult {
	passed: boolean;
	exitCode: number | null;
	log: string;
}

const benchmarkDirectory: string = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory: string = path.dirname(benchmarkDirectory);
const [runId, requestedTaskId] = process.argv.slice(2);

if (!runId) {
	throw new Error('Usage: npx tsx benchmarks/evaluate-gates.mts <run-id> [task-id]');
}

const runDirectory: string = path.join(repositoryDirectory, '.tmp', 'benchmark-runs', runId);
const manifest: RunManifest = JSON.parse(
	fs.readFileSync(path.join(runDirectory, 'run-manifest.json'), 'utf8')
) as RunManifest;
const selectedTasks: RunTask[] = requestedTaskId
	? manifest.tasks.filter((task: RunTask): boolean => task.id === requestedTaskId)
	: manifest.tasks;

if (selectedTasks.length === 0) {
	throw new Error(`Task '${requestedTaskId}' is not part of run '${runId}'.`);
}

const npmCommand: string = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const copyEvidence = async (workspace: string, destination: string): Promise<void> => {
	if (fs.existsSync(destination)) {
		return;
	}

	fs.mkdirSync(destination, { recursive: true });
	await createSourceArchive(
		workspace,
		path.join(destination, 'source.zip'),
		path.join(workspace, 'benchmark-delivery')
	);

	for (const relativePath of [
		'benchmark-delivery',
		'preview/output',
		'preview/visual-review.json',
		'generation-brief.json',
		'datasource-contract.json',
		'sample-datasource.json'
	]) {
		const sourcePath: string = path.join(workspace, relativePath);

		if (fs.existsSync(sourcePath)) {
			fs.cpSync(sourcePath, path.join(destination, relativePath), { recursive: true });
		}
	}
};

const inspectDelivery = (workspace: string): { passed: boolean; zipPath: string } => {
	const deliveryDirectory: string = path.join(workspace, 'benchmark-delivery');
	const manifestPath: string = path.join(deliveryDirectory, 'delivery-manifest.json');

	if (!fs.existsSync(manifestPath)) {
		return { passed: false, zipPath: '' };
	}

	const deliveryManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
		acceptance?: { uploadReady?: boolean };
		app?: { zipFile?: string };
	};
	const zipFile: string = deliveryManifest.app?.zipFile ?? '';
	const zipPath: string = path.join(deliveryDirectory, zipFile);

	if (!deliveryManifest.acceptance?.uploadReady || !zipFile || !fs.existsSync(zipPath)) {
		return { passed: false, zipPath };
	}

	const listing = spawnSync('tar', ['-tf', zipPath], { encoding: 'utf8', windowsHide: true });
	const entries: string[] = listing.status === 0 ? listing.stdout.split(/\r?\n/u).filter(Boolean) : [];
	const required: string[] = [
		'assets/app.js',
		'assets/app-chrome-49.js',
		'editor-assets/config.json',
		'editor-assets/icon.png',
		'editor-assets/placeholder.png'
	];

	return { passed: required.every((entry: string): boolean => entries.includes(entry)), zipPath };
};

for (const task of selectedTasks) {
	const evaluationDirectory: string = path.join(runDirectory, 'evaluation', task.id);
	const logsDirectory: string = path.join(evaluationDirectory, 'logs');
	fs.mkdirSync(logsDirectory, { recursive: true });
	await copyEvidence(task.workspace, path.join(runDirectory, 'first-pass', task.id));
	const previewPort: string = String(await findAvailablePort());
	const environment: NodeJS.ProcessEnv = {
		...process.env,
		DISABLE_MINIO_UPLOAD: 'true',
		SIMPLE_OUTPUT: 'true',
		WALLBOARD_PREVIEW_TEST_PORT: previewPort
	};

	const run = (id: string, script: string): CommandResult => {
		const result = spawnSync(npmCommand, ['run', script], {
			cwd: task.workspace,
			env: environment,
			encoding: 'utf8',
			shell: process.platform === 'win32',
			windowsHide: true
		});
		const output: string = `${result.stdout ?? ''}${result.stderr ?? ''}`;
		const logPath: string = path.join(logsDirectory, `${id}.log`);
		fs.writeFileSync(logPath, output, 'utf8');

		return { passed: result.status === 0, exitCode: result.status, log: logPath };
	};

	const brief = run('brief', 'validate:brief');
	const project = run('project', 'validate:project');
	const visual = run('visual', 'validate:visual');
	const visualReview = run('visual-review', 'validate:visual-review');
	const legacy = run('legacy', 'validate:legacy');
	const datasourcePackage = run('datasource-package', 'prepare:datasource-package');
	const build = run('build', 'build:production');
	const packageAssets = run('package-assets', 'validate:package-assets');
	const delivery = inspectDelivery(task.workspace);
	const datasource = validateDatasourceGate(task.workspace, project.passed);
	const chromeBundle: boolean = fs.existsSync(path.join(task.workspace, 'dist', 'assets', 'app-chrome-49.js'));
	const results = {
		runId: manifest.runId,
		taskId: task.id,
		evaluatedAt: new Date().toISOString(),
		binaryGates: {
			briefValid: brief.passed,
			projectValid: project.passed,
			visualValid: visual.passed && visualReview.passed,
			packageValid: datasourcePackage.passed && build.passed && packageAssets.passed && delivery.passed,
			legacyBundleValid: legacy.passed && chromeBundle,
			datasourceContractValid: datasource.contractValid,
			fictionalDataOnly: datasource.fictionalOnly,
			versionPolicyValid: validateVersionOnePolicy(task.workspace)
		},
		deliveryZip: delivery.zipPath,
		commands: { brief, project, visual, visualReview, legacy, datasourcePackage, build, packageAssets }
	};

	fs.writeFileSync(path.join(evaluationDirectory, 'first-pass-gates.json'), `${JSON.stringify(results, null, '\t')}\n`, 'utf8');
	console.log(`${task.id}: ${Object.values(results.binaryGates).every(Boolean) ? 'PASS' : 'FAIL'}`);
}
