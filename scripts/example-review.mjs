import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { materializeExample } from './example-materialization.mjs';
import { selectReferenceScreenshots } from './example-screenshots.mjs';
import { findAvailablePort } from './playwright/free-port.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const exampleId = process.argv[3];
const reviewDirectory = exampleId ? path.join(rootDirectory, '.tmp', 'review', exampleId) : '';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!['--prepare', '--promote'].includes(mode) || !exampleId) {
	throw new Error('Usage: npm run example:review:prepare -- <example-id> or npm run example:review:promote -- <example-id>.');
}

const exampleDirectory = path.join(rootDirectory, 'examples', exampleId);

if (!fs.existsSync(path.join(exampleDirectory, 'example.json'))) {
	throw new Error(`Unknown example '${exampleId}'.`);
}

const runNpm = (script, environment = {}) => {
	const result = spawnSync(npmCommand, ['run', script], {
		cwd: reviewDirectory,
		env: { ...process.env, ...environment },
		shell: process.platform === 'win32',
		stdio: 'inherit'
	});

	if (result.status !== 0) {
		throw new Error(`npm run ${script} failed with exit code ${result.status ?? 'unknown'}.`);
	}
};

if (mode === '--prepare') {
	materializeExample({ rootDirectory, exampleId, targetDirectory: reviewDirectory });
	const sourceNodeModules = path.join(rootDirectory, 'node_modules');

	if (!fs.existsSync(sourceNodeModules)) {
		throw new Error('Root node_modules is required. Run npm run setup first.');
	}

	fs.symlinkSync(sourceNodeModules, path.join(reviewDirectory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
	runNpm('validate:project');
	const previewPort = process.env.WALLBOARD_PREVIEW_TEST_PORT ?? String(await findAvailablePort());
	runNpm('validate:visual', { WALLBOARD_PREVIEW_TEST_PORT: previewPort });
	runNpm('prepare:visual-review');
	console.log(`Inspect screenshots in ${path.join(reviewDirectory, 'preview', 'output')}`);
	console.log(`Complete ${path.join(reviewDirectory, 'preview', 'visual-review.json')}, then promote the review.`);
} else {
	if (!fs.existsSync(reviewDirectory)) {
		throw new Error(`Review workspace '${reviewDirectory}' does not exist. Prepare it first.`);
	}

	runNpm('validate:visual-review');
	const sourceScreenshotDirectory = path.join(reviewDirectory, 'preview', 'output');
	const targetScreenshotDirectory = path.join(exampleDirectory, 'screenshots');
	const sourceReviewPath = path.join(reviewDirectory, 'preview', 'visual-review.json');
	const targetReviewPath = path.join(exampleDirectory, 'overlay', 'preview', 'visual-review.json');
	const availableScreenshots = fs.readdirSync(sourceScreenshotDirectory, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.png'));
	const manifest = JSON.parse(fs.readFileSync(path.join(exampleDirectory, 'example.json'), 'utf8'));
	const screenshots = selectReferenceScreenshots(
		manifest,
		availableScreenshots.map((entry) => entry.name)
	);

	fs.rmSync(targetScreenshotDirectory, { recursive: true, force: true });
	fs.mkdirSync(targetScreenshotDirectory, { recursive: true });

	for (const screenshot of screenshots) {
		fs.copyFileSync(
			path.join(sourceScreenshotDirectory, screenshot),
			path.join(targetScreenshotDirectory, screenshot)
		);
	}

	fs.mkdirSync(path.dirname(targetReviewPath), { recursive: true });
	fs.copyFileSync(sourceReviewPath, targetReviewPath);
	console.log(`Promoted ${screenshots.length} reviewed screenshots for '${exampleId}'.`);
}
