import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exampleId = process.argv[2];
const requestedTarget = process.argv[3];

if (!exampleId) {
	throw new Error('Usage: npm run example:materialize -- <example-id> [target-directory]');
}

const exampleDirectory = path.join(rootDirectory, 'examples', exampleId);
const manifestPath = path.join(exampleDirectory, 'example.json');
const overlayDirectory = path.join(exampleDirectory, 'overlay');
const targetDirectory = path.resolve(
	rootDirectory,
	requestedTarget ?? path.join('.tmp', 'examples', exampleId)
);

if (!fs.existsSync(manifestPath) || !fs.existsSync(overlayDirectory)) {
	throw new Error(`Example '${exampleId}' does not contain example.json and overlay/.`);
}

if (targetDirectory === rootDirectory || rootDirectory.startsWith(`${targetDirectory}${path.sep}`)) {
	throw new Error('The materialization target must not be the boilerplate repository or its parent.');
}

if (requestedTarget && fs.existsSync(targetDirectory)) {
	const targetStats = fs.lstatSync(targetDirectory);
	const targetEntries = targetStats.isDirectory() ? fs.readdirSync(targetDirectory) : ['existing-file'];

	if (!targetStats.isDirectory() || targetEntries.length > 0) {
		throw new Error('An explicit materialization target must be a new or empty directory.');
	}
}

const excludedRoots = new Set(['.git', '.tmp', 'dist', 'examples', 'node_modules']);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

fs.rmSync(targetDirectory, { recursive: true, force: true });
fs.mkdirSync(targetDirectory, { recursive: true });

for (const entry of fs.readdirSync(rootDirectory, { withFileTypes: true })) {
	if (excludedRoots.has(entry.name)) {
		continue;
	}

	const sourcePath = path.join(rootDirectory, entry.name);
	const destinationPath = path.join(targetDirectory, entry.name);

	fs.cpSync(sourcePath, destinationPath, {
		recursive: true,
		filter: (source) => {
			const relativePath = path.relative(rootDirectory, source);

			return !relativePath.startsWith(path.join('preview', 'output')) &&
				!relativePath.startsWith(path.join('preview', '.playwright'));
		}
	});
}

for (const relativePath of manifest.remove ?? []) {
	fs.rmSync(path.join(targetDirectory, relativePath), { recursive: true, force: true });
}

fs.cpSync(overlayDirectory, targetDirectory, { recursive: true, force: true });

for (const relativePath of manifest.artifacts ?? []) {
	const sourcePath = path.resolve(exampleDirectory, relativePath);
	const destinationPath = path.resolve(targetDirectory, relativePath);

	if (!sourcePath.startsWith(`${exampleDirectory}${path.sep}`)) {
		throw new Error(`Artifact '${relativePath}' must stay inside its example directory.`);
	}

	if (!destinationPath.startsWith(`${targetDirectory}${path.sep}`)) {
		throw new Error(`Artifact '${relativePath}' must stay inside the materialized project.`);
	}

	if (!fs.existsSync(sourcePath)) {
		throw new Error(`Artifact '${relativePath}' does not exist.`);
	}

	fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
	fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
}

console.log(`Materialized '${exampleId}' at ${targetDirectory}`);
console.log('Run npm run setup, then npm run deliver -- <output-directory> in that directory.');
