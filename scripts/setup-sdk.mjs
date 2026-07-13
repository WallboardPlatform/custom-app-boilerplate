import { readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SDK_PACKAGE = 'wallboard-app-sdk';
const DEFAULT_REGISTRY = 'https://nexus.wallboard.info/nexus/repository/npm-wallboard/';
const PUBLIC_NPM_REGISTRY = 'https://registry.npmjs.org/';

function getArgValue(name) {
	const index = process.argv.indexOf(name);
	if (index === -1) {
		return undefined;
	}

	return process.argv[index + 1];
}

function getRequestedVersion() {
	const explicit = getArgValue('--version') ?? getArgValue('-v') ?? process.env.WALLBOARD_APP_SDK_VERSION;
	if (explicit) {
		return explicit;
	}

	const positional = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
	return positional ?? 'latest';
}

function ensureTrailingSlash(value) {
	return value.endsWith('/') ? value : `${value}/`;
}

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: {
			Accept: 'application/vnd.npm.install-v1+json, application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
	}

	return response.json();
}

function resolveVersion(metadata, requestedVersion) {
	if (requestedVersion === 'latest') {
		const latest = metadata['dist-tags']?.latest;
		if (!latest) {
			throw new Error(`Registry metadata for ${SDK_PACKAGE} does not include dist-tags.latest`);
		}

		return latest;
	}

	if (!metadata.versions?.[requestedVersion]) {
		const available = Object.keys(metadata.versions ?? {}).slice(-10).join(', ');
		throw new Error(`SDK version ${requestedVersion} not found. Recent available versions: ${available}`);
	}

	return requestedVersion;
}

function setSdkDependency(packageJson, tarballUrl) {
	if (packageJson.dependencies?.[SDK_PACKAGE]) {
		packageJson.dependencies[SDK_PACKAGE] = tarballUrl;
		return 'dependencies';
	}

	packageJson.devDependencies ??= {};
	packageJson.devDependencies[SDK_PACKAGE] = tarballUrl;
	return 'devDependencies';
}

async function updatePackageJson(tarballUrl) {
	const packagePath = path.resolve('package.json');
	const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
	const section = setSdkDependency(packageJson, tarballUrl);

	await writeFile(packagePath, `${JSON.stringify(packageJson, null, '\t')}\n`);
	return section;
}

async function removeStaleLockfile(tarballUrl) {
	const lockPath = path.resolve('package-lock.json');
	if (!existsSync(lockPath)) {
		return false;
	}

	const lockContent = await readFile(lockPath, 'utf8');
	const stale =
		lockContent.includes('devops.wallboard.info/nexus') ||
		lockContent.includes('"wallboard-app-sdk": "^') ||
		!lockContent.includes(tarballUrl);

	if (!stale) {
		return false;
	}

	await rm(lockPath);
	return true;
}

async function main() {
	const registry = ensureTrailingSlash(process.env.WALLBOARD_SDK_REGISTRY ?? DEFAULT_REGISTRY);
	const metadataUrl = new URL(SDK_PACKAGE, registry).toString();
	const requestedVersion = getRequestedVersion();
	const metadata = await fetchJson(metadataUrl);
	const version = resolveVersion(metadata, requestedVersion);
	const versionMetadata = metadata.versions[version];
	const tarballUrl = versionMetadata?.dist?.tarball;

	if (!tarballUrl) {
		throw new Error(`Registry metadata for ${SDK_PACKAGE}@${version} does not include dist.tarball`);
	}

	const section = await updatePackageJson(tarballUrl);
	const removedLockfile = await removeStaleLockfile(tarballUrl);

	console.log(`Configured ${SDK_PACKAGE}@${version} in ${section}.`);
	console.log(`SDK tarball: ${tarballUrl}`);
	if (removedLockfile) {
		console.log(`Removed stale package-lock.json. Run npm install --registry=${PUBLIC_NPM_REGISTRY} to regenerate it.`);
	} else {
		console.log('package-lock.json is already compatible or not present.');
	}
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
