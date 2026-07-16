import fs from 'node:fs';
import path from 'node:path';

const excludedRoots = new Set(['.git', '.tmp', 'benchmarks', 'dist', 'examples', 'node_modules', 'templates']);

const resolveInside = (directory, relativePath, label) => {
	const resolvedPath = path.resolve(directory, relativePath);

	if (!resolvedPath.startsWith(`${directory}${path.sep}`)) {
		throw new Error(`${label} '${relativePath}' must stay inside '${directory}'.`);
	}

	return resolvedPath;
};

export const materializeExample = ({ rootDirectory, exampleId, targetDirectory, requireEmpty = false }) => {
	const exampleDirectory = path.join(rootDirectory, 'examples', exampleId);
	const manifestPath = path.join(exampleDirectory, 'example.json');
	const overlayDirectory = path.join(exampleDirectory, 'overlay');

	if (!fs.existsSync(manifestPath) || !fs.existsSync(overlayDirectory)) {
		throw new Error(`Example '${exampleId}' does not contain example.json and overlay/.`);
	}

	if (targetDirectory === rootDirectory || rootDirectory.startsWith(`${targetDirectory}${path.sep}`)) {
		throw new Error('The materialization target must not be the boilerplate repository or its parent.');
	}

	if (requireEmpty && fs.existsSync(targetDirectory)) {
		const targetStats = fs.lstatSync(targetDirectory);
		const targetEntries = targetStats.isDirectory() ? fs.readdirSync(targetDirectory) : ['existing-file'];

		if (!targetStats.isDirectory() || targetEntries.length > 0) {
			throw new Error('An explicit materialization target must be a new or empty directory.');
		}
	}

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

				return !relativePath.startsWith(path.join('preview', 'output'))
					&& !relativePath.startsWith(path.join('preview', '.playwright'));
			}
		});
	}

	for (const relativePath of manifest.remove ?? []) {
		fs.rmSync(resolveInside(targetDirectory, relativePath, 'Removal path'), { recursive: true, force: true });
	}

	fs.cpSync(overlayDirectory, targetDirectory, { recursive: true, force: true });

	for (const relativePath of manifest.artifacts ?? []) {
		const sourcePath = resolveInside(exampleDirectory, relativePath, 'Artifact');
		const destinationPath = resolveInside(targetDirectory, relativePath, 'Artifact');

		if (!fs.existsSync(sourcePath)) {
			throw new Error(`Artifact '${relativePath}' does not exist.`);
		}

		fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
		fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
	}

	return targetDirectory;
};
