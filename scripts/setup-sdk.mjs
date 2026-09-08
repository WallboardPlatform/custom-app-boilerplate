import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const SDK_PACKAGE = 'wallboard-app-sdk';
const DEFAULT_REGISTRY = 'https://nexus.wallboard.info/nexus/repository/npm-wallboard/';
const GITHUB_API = 'https://api.github.com/repos/WallboardPlatform/custom-app-boilerplate';
const GITHUB_RELEASE_BASE_URL = 'https://github.com/WallboardPlatform/custom-app-boilerplate/releases/download/';
const STABLE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const EXACT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[\da-zA-Z.-]+)?$/;

export function getRequestedVersion(args = process.argv.slice(2), env = process.env) {
	if (args.length === 0) {
		return env.WALLBOARD_APP_SDK_VERSION ?? 'latest';
	}
	if (args.length === 1 && !args[0].startsWith('-')) {
		return args[0];
	}
	if (args.length === 2 && ['--version', '-v'].includes(args[0])) {
		return args[1];
	}
	throw new Error('Usage: npm run setup:sdk -- [--version <exact-version|latest>]');
}

function validateVersion(version) {
	if (typeof version !== 'string' || !EXACT_VERSION.test(version)) {
		throw new Error(`Invalid SDK version: ${version}. Use latest or an exact version.`);
	}
	return version;
}

async function request(url, fetchImpl) {
	const response = await fetchImpl(url, {
		headers: { Accept: 'application/json, application/octet-stream, */*' },
		signal: AbortSignal.timeout(20_000)
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
	}
	return response;
}

async function verifyTarball(url, expectedSha256, fetchImpl) {
	const response = await request(url, fetchImpl);
	const buffer = Buffer.from(await response.arrayBuffer());
	if (expectedSha256 && createHash('sha256').update(buffer).digest('hex') !== expectedSha256) {
		throw new Error(`Checksum mismatch for ${url}`);
	}
	return buffer.length;
}

async function resolveFromRegistry(requestedVersion, env, fetchImpl) {
	const registry = env.WALLBOARD_SDK_REGISTRY ?? DEFAULT_REGISTRY;
	const metadataUrl = new URL(SDK_PACKAGE, registry.endsWith('/') ? registry : `${registry}/`).toString();
	const metadata = await (await request(metadataUrl, fetchImpl)).json();
	const version = validateVersion(requestedVersion === 'latest' ? metadata['dist-tags']?.latest : requestedVersion);
	const tarballUrl = metadata.versions?.[version]?.dist?.tarball;
	if (!tarballUrl) {
		throw new Error(`Registry metadata does not contain a tarball for ${SDK_PACKAGE}@${version}`);
	}
	const size = await verifyTarball(tarballUrl, undefined, fetchImpl);
	return { version, tarballUrl, source: 'Wallboard Nexus', size };
}

async function findLatestSdkRelease(fetchImpl) {
	const candidates = [];
	// Release creation order and the repository's generic "latest" release need not match SDK version order.
	for (let page = 1; ; page += 1) {
		const releases = await (await request(`${GITHUB_API}/releases?per_page=100&page=${page}`, fetchImpl)).json();
		if (!Array.isArray(releases)) {
			throw new Error('Invalid GitHub releases response');
		}
		for (const release of releases) {
			if (release.draft || release.prerelease || !release.tag_name?.startsWith(`${SDK_PACKAGE}-`)) {
				continue;
			}
			const version = release.tag_name.slice(SDK_PACKAGE.length + 1);
			if (STABLE_VERSION.test(version)) {
				candidates.push({ release, version });
			}
		}
		if (releases.length < 100) {
			break;
		}
	}
	if (candidates.length === 0) {
		throw new Error('No published stable Wallboard SDK release found on GitHub');
	}
	candidates.sort((a, b) => {
		const left = a.version.split('.').map(Number);
		const right = b.version.split('.').map(Number);
		return right[0] - left[0] || right[1] - left[1] || right[2] - left[2];
	});
	return candidates[0];
}

async function resolveFromGitHubFallback(requestedVersion, env, fetchImpl) {
	let version = requestedVersion === 'latest' ? env.WALLBOARD_APP_SDK_FALLBACK_VERSION : requestedVersion;
	if (env.WALLBOARD_APP_SDK_FALLBACK_URL) {
		validateVersion(version);
		const expectedSha256 = env.WALLBOARD_APP_SDK_FALLBACK_SHA256;
		if (!/^[a-f\d]{64}$/.test(expectedSha256 ?? '')) {
			throw new Error('A custom fallback URL requires WALLBOARD_APP_SDK_FALLBACK_SHA256 and an exact version');
		}
		const tarballUrl = env.WALLBOARD_APP_SDK_FALLBACK_URL;
		const size = await verifyTarball(tarballUrl, expectedSha256, fetchImpl);
		return { version, tarballUrl, source: 'Custom SDK fallback', size, expectedSha256 };
	}

	let release;
	if (version) {
		validateVersion(version);
		release = await (await request(`${GITHUB_API}/releases/tags/${SDK_PACKAGE}-${version}`, fetchImpl)).json();
	} else {
		({ release, version } = await findLatestSdkRelease(fetchImpl));
	}
	if (release.draft || release.tag_name !== `${SDK_PACKAGE}-${version}`) {
		throw new Error(`No published GitHub SDK release for ${version}`);
	}
	const asset = release.assets?.find((entry) => entry.name === `${SDK_PACKAGE}-${version}.tgz`);
	const expectedSha256 = asset?.digest?.match(/^sha256:([a-f\d]{64})$/)?.[1];
	if (!asset || asset.state !== 'uploaded' || !expectedSha256) {
		throw new Error(
			`GitHub SDK release ${version} needs an uploaded ${SDK_PACKAGE}-${version}.tgz with a SHA-256 digest`
		);
	}
	const tarballUrl = `${GITHUB_RELEASE_BASE_URL}${SDK_PACKAGE}-${version}/${asset.name}`;
	const size = await verifyTarball(tarballUrl, expectedSha256, fetchImpl);
	return { version, tarballUrl, source: 'GitHub Release fallback', size, expectedSha256 };
}

export async function resolveSdkTarball(requestedVersion, { env = process.env, fetchImpl = fetch } = {}) {
	if (requestedVersion !== 'latest') {
		validateVersion(requestedVersion);
	}
	try {
		return await resolveFromRegistry(requestedVersion, env, fetchImpl);
	} catch (registryError) {
		try {
			return { ...(await resolveFromGitHubFallback(requestedVersion, env, fetchImpl)), registryError };
		} catch (fallbackError) {
			throw new Error(`Nexus: ${registryError.message}\nSDK fallback: ${fallbackError.message}`);
		}
	}
}

export async function configureSdk(requestedVersion, { directory = process.cwd(), ...options } = {}) {
	const resolved = await resolveSdkTarball(requestedVersion, options);
	const packagePath = path.join(directory, 'package.json');
	const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
	const section = packageJson.dependencies?.[SDK_PACKAGE] ? 'dependencies' : 'devDependencies';
	packageJson[section] ??= {};
	packageJson[section][SDK_PACKAGE] = resolved.tarballUrl;
	await writeFile(packagePath, `${JSON.stringify(packageJson, null, '\t')}\n`);
	// npm install reconciles this SDK change while retaining unrelated dependency pins.
	return { ...resolved, section };
}

async function main() {
	const resolved = await configureSdk(getRequestedVersion());
	console.log(`Configured ${SDK_PACKAGE}@${resolved.version} in ${resolved.section}.`);
	console.log(`SDK source: ${resolved.source}.`);
	console.log(`SDK tarball: ${resolved.tarballUrl}`);
	console.log(`SDK tarball size: ${resolved.size} bytes.`);
	if (resolved.expectedSha256) {
		console.log(`SDK SHA-256 verified: ${resolved.expectedSha256}`);
	}
	if (resolved.registryError) {
		console.log(`Nexus unavailable, used mirrored SDK ${resolved.version}: ${resolved.registryError.message}`);
	}
	console.log('Run npm install --registry=https://registry.npmjs.org/ to reconcile package-lock.json.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
	main().catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	});
}
