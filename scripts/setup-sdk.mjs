import { readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';

const SDK_PACKAGE = 'wallboard-app-sdk';
const DEFAULT_REGISTRY = 'https://nexus.wallboard.info/nexus/repository/npm-wallboard/';
const PUBLIC_NPM_REGISTRY = 'https://registry.npmjs.org/';
const GITHUB_RELEASE_BASE_URL = 'https://github.com/WallboardPlatform/custom-app-boilerplate/releases/download/';
const DEFAULT_FALLBACK_VERSION = '2.0.85';
const FALLBACK_SHA256 = {
	'2.0.85': '6d28540f1f889723f2519a38a2c059da48976cfaf9044b9d9c9077c67bd45e04',
};

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

async function fetchTarball(url) {
	const response = await fetch(url, {
		headers: {
			Accept: 'application/octet-stream, application/gzip, */*',
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
	}

	return Buffer.from(await response.arrayBuffer());
}

function getSha256(buffer) {
	return createHash('sha256').update(buffer).digest('hex');
}

async function verifyTarball(url, expectedSha256) {
	const buffer = await fetchTarball(url);

	if (expectedSha256) {
		const actualSha256 = getSha256(buffer);
		if (actualSha256 !== expectedSha256) {
			throw new Error(`Checksum mismatch for ${url}. Expected ${expectedSha256}, got ${actualSha256}`);
		}
	}

	return buffer.length;
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

function getGitHubFallbackVersion(requestedVersion) {
	if (requestedVersion === 'latest') {
		return process.env.WALLBOARD_APP_SDK_FALLBACK_VERSION ?? DEFAULT_FALLBACK_VERSION;
	}

	return requestedVersion;
}

function getGitHubFallbackUrl(version) {
	return (
		process.env.WALLBOARD_APP_SDK_FALLBACK_URL ??
		`${GITHUB_RELEASE_BASE_URL}wallboard-app-sdk-${version}/wallboard-app-sdk-${version}.tgz`
	);
}

function getFallbackSha256(version) {
	return process.env.WALLBOARD_APP_SDK_FALLBACK_SHA256 ?? FALLBACK_SHA256[version];
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

async function resolveFromRegistry(requestedVersion) {
	const registry = ensureTrailingSlash(process.env.WALLBOARD_SDK_REGISTRY ?? DEFAULT_REGISTRY);
	const metadataUrl = new URL(SDK_PACKAGE, registry).toString();
	const metadata = await fetchJson(metadataUrl);
	const version = resolveVersion(metadata, requestedVersion);
	const versionMetadata = metadata.versions[version];
	const tarballUrl = versionMetadata?.dist?.tarball;

	if (!tarballUrl) {
		throw new Error(`Registry metadata for ${SDK_PACKAGE}@${version} does not include dist.tarball`);
	}

	const size = await verifyTarball(tarballUrl);
	return {
		version,
		tarballUrl,
		source: 'Wallboard Nexus',
		size,
	};
}

async function resolveFromGitHubFallback(requestedVersion, registryError) {
	const version = getGitHubFallbackVersion(requestedVersion);
	const tarballUrl = getGitHubFallbackUrl(version);
	const expectedSha256 = getFallbackSha256(version);
	const size = await verifyTarball(tarballUrl, expectedSha256);

	return {
		version,
		tarballUrl,
		source: 'GitHub Release fallback',
		size,
		expectedSha256,
		registryError,
	};
}

async function resolveSdkTarball(requestedVersion) {
	try {
		return await resolveFromRegistry(requestedVersion);
	} catch (error) {
		return resolveFromGitHubFallback(requestedVersion, error);
	}
}

async function main() {
	const requestedVersion = getRequestedVersion();
	const resolved = await resolveSdkTarball(requestedVersion);
	const section = await updatePackageJson(resolved.tarballUrl);
	const removedLockfile = await removeStaleLockfile(resolved.tarballUrl);

	console.log(`Configured ${SDK_PACKAGE}@${resolved.version} in ${section}.`);
	console.log(`SDK source: ${resolved.source}.`);
	console.log(`SDK tarball: ${resolved.tarballUrl}`);
	console.log(`SDK tarball size: ${resolved.size} bytes.`);
	if (resolved.expectedSha256) {
		console.log(`SDK SHA-256 verified: ${resolved.expectedSha256}`);
	}
	if (resolved.registryError) {
		console.log(`Registry unavailable, used fallback: ${resolved.registryError.message}`);
	}
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
