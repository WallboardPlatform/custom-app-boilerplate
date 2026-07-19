import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const normalizePath = (value) => value.split(path.sep).join('/');

const resolveInside = (directory, relativePath, label) => {
	const resolvedPath = path.resolve(directory, relativePath);

	if (resolvedPath !== directory && !resolvedPath.startsWith(`${directory}${path.sep}`)) {
		throw new Error(`${label} '${relativePath}' must stay inside '${directory}'.`);
	}

	return resolvedPath;
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const writeFileWithoutCollision = (destinationPath, value) => {
	if (fs.existsSync(destinationPath)) {
		const current = fs.readFileSync(destinationPath);

		if (!current.equals(value)) {
			throw new Error(`Capability file would overwrite different content: ${normalizePath(destinationPath)}`);
		}

		return;
	}

	fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
	fs.writeFileSync(destinationPath, value);
};

const copyOverlay = (sourceDirectory, targetDirectory) => {
	if (!fs.existsSync(sourceDirectory)) {
		return;
	}

	for (const entry of fs.readdirSync(sourceDirectory, { withFileTypes: true })) {
		const sourcePath = path.join(sourceDirectory, entry.name);
		const destinationPath = path.join(targetDirectory, entry.name);

		if (entry.isDirectory()) {
			copyOverlay(sourcePath, destinationPath);
		} else {
			writeFileWithoutCollision(destinationPath, fs.readFileSync(sourcePath));
		}
	}
};

const installCompressedAsset = (capabilityDirectory, targetDirectory, asset) => {
	const sourcePath = resolveInside(capabilityDirectory, asset.source, 'Capability asset');
	const destinationPath = resolveInside(targetDirectory, asset.target, 'Capability target');

	if (!fs.existsSync(sourcePath)) {
		throw new Error(`Capability asset does not exist: ${normalizePath(asset.source)}`);
	}

	const compressed = fs.readFileSync(sourcePath);
	if (sha256(compressed) !== asset.compressedSha256) {
		throw new Error(`Capability asset checksum mismatch: ${normalizePath(asset.source)}`);
	}

	const output = zlib.gunzipSync(compressed);
	if (sha256(output) !== asset.outputSha256) {
		throw new Error(`Expanded capability asset checksum mismatch: ${normalizePath(asset.target)}`);
	}

	writeFileWithoutCollision(destinationPath, output);
};

const recordCapability = (targetDirectory, capabilityId) => {
	const packagePath = path.join(targetDirectory, 'package.json');
	if (!fs.existsSync(packagePath)) {
		throw new Error(`Capability target has no package.json: ${targetDirectory}`);
	}

	const packageJson = readJson(packagePath);
	const existing = Array.isArray(packageJson.wallboardCapabilities) ? packageJson.wallboardCapabilities : [];
	packageJson.wallboardCapabilities = [...new Set([...existing, capabilityId])].sort();
	fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, '\t')}\n`);
};

export const applyCapability = ({ rootDirectory, targetDirectory, capabilityId }) => {
	if (typeof capabilityId !== 'string' || !/^[a-z][a-z0-9-]*$/.test(capabilityId)) {
		throw new Error(`Invalid capability id '${String(capabilityId)}'.`);
	}

	const capabilityDirectory = path.join(rootDirectory, 'capabilities', capabilityId);
	const manifestPath = path.join(capabilityDirectory, 'capability.json');

	if (!fs.existsSync(manifestPath)) {
		throw new Error(`Unknown capability '${capabilityId}'.`);
	}

	const manifest = readJson(manifestPath);
	if (manifest.id !== capabilityId || manifest.version !== 1) {
		throw new Error(`Capability '${capabilityId}' has an invalid manifest identity or version.`);
	}

	copyOverlay(path.join(capabilityDirectory, 'overlay'), targetDirectory);

	for (const asset of manifest.compressedAssets ?? []) {
		installCompressedAsset(capabilityDirectory, targetDirectory, asset);
	}

	recordCapability(targetDirectory, capabilityId);

	return {
		capabilityId,
		files: manifest.files ?? [],
		targetDirectory
	};
};
