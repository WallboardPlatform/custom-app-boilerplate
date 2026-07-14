import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exampleId = process.argv[2];
const requestedDeliveryDirectory = process.argv[3];

if (!exampleId) {
	throw new Error('Usage: npm run example:accept -- <example-id> [delivery-directory]');
}

const exampleDirectory = path.join(rootDirectory, 'examples', exampleId);

if (!fs.existsSync(path.join(exampleDirectory, 'example.json'))) {
	throw new Error(`Unknown example '${exampleId}'.`);
}

const workDirectory = path.join(rootDirectory, '.tmp', 'acceptance', exampleId);
const deliveryDirectory = path.resolve(
	rootDirectory,
	requestedDeliveryDirectory ?? path.join('.tmp', 'deliveries', exampleId)
);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const run = (command, args, cwd, useShell = false) => {
	const result = spawnSync(command, args, {
		cwd,
		shell: useShell && process.platform === 'win32',
		stdio: 'inherit'
	});

	if (result.status !== 0) {
		throw new Error(
			`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}${result.error ? `: ${result.error.message}` : '.'}`
		);
	}
};

fs.rmSync(workDirectory, { recursive: true, force: true });
run(process.execPath, [path.join(rootDirectory, 'scripts', 'materialize-example.mjs'), exampleId, workDirectory], rootDirectory);

const sourceNodeModules = path.join(rootDirectory, 'node_modules');
const targetNodeModules = path.join(workDirectory, 'node_modules');

if (!fs.existsSync(sourceNodeModules)) {
	throw new Error('Root node_modules is required. Run npm run setup first.');
}

fs.symlinkSync(sourceNodeModules, targetNodeModules, process.platform === 'win32' ? 'junction' : 'dir');
fs.rmSync(deliveryDirectory, { recursive: true, force: true });

run(npmCommand, ['run', 'deliver', '--', deliveryDirectory], workDirectory, true);

console.log(`Accepted example '${exampleId}'.`);
console.log(`Delivery: ${deliveryDirectory}`);
