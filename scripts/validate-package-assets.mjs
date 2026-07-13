import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(rootDirectory, 'dist');
const propertiesPath = path.join(rootDirectory, 'src', 'editor-assets', 'properties.json');

const normalizePath = (value) => value.split(path.sep).join('/');

const listFiles = (directory) => {
	if (!fs.existsSync(directory)) {
		return [];
	}

	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);

		return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
	});
};

if (!fs.existsSync(propertiesPath)) {
	throw new Error(`Package metadata was not found: ${propertiesPath}`);
}

const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8'));
const resourceList = Array.isArray(properties.resourceList) ? properties.resourceList : [];
const localResources = resourceList.filter(
	(resource) => typeof resource === 'string' && !/^[a-z]+:\/\//i.test(resource)
);
const resourceSet = new Set(localResources);
const emittedAssets = listFiles(path.join(distDirectory, 'assets')).map((filePath) =>
	normalizePath(path.relative(distDirectory, filePath))
);
const sourceAssetUrlFailures = listFiles(path.join(rootDirectory, 'src'))
	.filter((filePath) => /\.(ts|tsx)$/i.test(filePath))
	.flatMap((filePath) => {
		const source = fs.readFileSync(filePath, 'utf8');
		const pattern = /new\s+URL\(\s*['"][^'"]+\.(?:png|jpe?g|gif|webp|svg)['"]\s*,\s*import\.meta\.url\s*\)/gi;

		return pattern.test(source) ? [normalizePath(path.relative(rootDirectory, filePath))] : [];
	});
const requiredFiles = [
	'assets/app.js',
	'assets/app-chrome-49.js',
	'editor-assets/config.json'
];
const missingRequiredFiles = requiredFiles.filter(
	(relativePath) => !fs.existsSync(path.join(distDirectory, relativePath))
);
const missingFromResourceList = emittedAssets.filter(
	(relativePath) => !resourceSet.has(relativePath)
);
const missingOnDisk = localResources.filter(
	(relativePath) => !fs.existsSync(path.join(distDirectory, relativePath))
);

const failures = [];

if (missingRequiredFiles.length > 0) {
	failures.push(`Required build files are missing:\n  ${missingRequiredFiles.join('\n  ')}`);
}

if (missingFromResourceList.length > 0) {
	failures.push(
		`Built runtime assets are missing from properties.json resourceList:\n  ${missingFromResourceList.join('\n  ')}`
	);
}

if (missingOnDisk.length > 0) {
	failures.push(`resourceList entries do not exist in dist:\n  ${missingOnDisk.join('\n  ')}`);
}

if (sourceAssetUrlFailures.length > 0) {
	failures.push(
		`Local media uses new URL(..., import.meta.url), which can resolve under /displayer at runtime. Use a static import instead:\n  ${sourceAssetUrlFailures.join('\n  ')}`
	);
}

if (failures.length > 0) {
	throw new Error(`Package asset validation failed.\n\n${failures.join('\n\n')}`);
}

console.log(`Package asset validation passed (${emittedAssets.length} runtime assets cache-listed).`);
