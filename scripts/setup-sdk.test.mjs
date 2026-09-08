import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { configureSdk, getRequestedVersion, resolveSdkTarball } from './setup-sdk.mjs';

const PACKAGE = 'wallboard-app-sdk';
const NEXUS = `https://nexus.wallboard.info/nexus/repository/npm-wallboard/${PACKAGE}`;
const API = 'https://api.github.com/repos/WallboardPlatform/custom-app-boilerplate';
const RELEASES = `${API}/releases?per_page=100&page=1`;
const BYTES = Buffer.from('representative SDK tarball bytes');
const SHA256 = createHash('sha256').update(BYTES).digest('hex');
const tarball = (version) =>
	`https://github.com/WallboardPlatform/custom-app-boilerplate/releases/download/${PACKAGE}-${version}/${PACKAGE}-${version}.tgz`;

function release(version, overrides = {}) {
	return {
		tag_name: `${PACKAGE}-${version}`,
		draft: false,
		prerelease: false,
		assets: [{ name: `${PACKAGE}-${version}.tgz`, state: 'uploaded', digest: `sha256:${SHA256}` }],
		...overrides
	};
}

function network(routes = {}, env = {}) {
	const calls = [];
	return {
		calls,
		env,
		fetchImpl: async (url, options) => {
			calls.push(url);
			assert.ok(options.signal instanceof AbortSignal, 'network requests need a timeout');
			if (url === NEXUS && !(url in routes)) return new Response('unavailable', { status: 503 });
			assert.ok(url in routes, `Unexpected request: ${url}`);
			const value = routes[url];
			if (value instanceof Error) throw value;
			if (value instanceof Response) return value;
			return new Response(Buffer.isBuffer(value) ? value : JSON.stringify(value));
		}
	};
}

test('CLI uses latest by default, supports exact pins, and rejects incomplete flags', () => {
	assert.equal(getRequestedVersion([], {}), 'latest');
	assert.equal(getRequestedVersion([], { WALLBOARD_APP_SDK_VERSION: '2.0.109' }), '2.0.109');
	for (const args of [['--version', '2.0.110'], ['-v', '2.0.110'], ['2.0.110']]) {
		assert.equal(getRequestedVersion(args, { WALLBOARD_APP_SDK_VERSION: '2.0.109' }), '2.0.110');
	}
	assert.throws(() => getRequestedVersion(['--version'], {}), /Usage:/);
	assert.throws(() => getRequestedVersion(['--unknown', '2.0.109'], {}), /Usage:/);
});

test('prefers the current Nexus latest without contacting GitHub', async () => {
	const url = 'https://nexus.example.test/sdk-2.0.110.tgz';
	const net = network({
		[NEXUS]: { 'dist-tags': { latest: '2.0.110' }, versions: { '2.0.110': { dist: { tarball: url } } } },
		[url]: BYTES
	});
	const result = await resolveSdkTarball('latest', net);
	assert.equal(result.version, '2.0.110');
	assert.equal(result.source, 'Wallboard Nexus');
	assert.deepEqual(net.calls, [NEXUS, url]);
});

test('discovers the highest stable SDK version, ignoring order, drafts, prereleases and unrelated releases', async () => {
	const net = network({
		[RELEASES]: [
			release('2.0.99'),
			release('3.0.0', { draft: true }),
			release('2.1.0', { prerelease: true }),
			release('4.0.0-beta.1'),
			release('9.0.0', { tag_name: 'boilerplate-9.0.0' }),
			release('2.0.109')
		],
		[tarball('2.0.109')]: BYTES
	});
	const result = await resolveSdkTarball('latest', net);
	assert.equal(result.version, '2.0.109');
	assert.equal(result.expectedSha256, SHA256);
	assert.equal(result.source, 'GitHub Release fallback');
});

test('paginates release discovery instead of assuming the first page contains the newest SDK', async () => {
	const net = network({
		[RELEASES]: Array.from({ length: 100 }, (_, i) => release('2.0.99', { tag_name: `app-${i}` })),
		[`${API}/releases?per_page=100&page=2`]: [release('2.0.110')],
		[tarball('2.0.110')]: BYTES
	});
	assert.equal((await resolveSdkTarball('latest', net)).version, '2.0.110');
});

test('uses the newest mirror if Nexus metadata resolves but the tarball download fails', async () => {
	const url = 'https://nexus.example.test/sdk-2.0.110.tgz';
	const net = network({
		[NEXUS]: { 'dist-tags': { latest: '2.0.110' }, versions: { '2.0.110': { dist: { tarball: url } } } },
		[url]: new Error('connection failed'),
		[RELEASES]: [release('2.0.109')],
		[tarball('2.0.109')]: BYTES
	});
	const result = await resolveSdkTarball('latest', net);
	assert.equal(result.version, '2.0.109');
	assert.match(result.registryError.message, /connection failed/);
});

test('an explicit pin requests only the matching release even when a fallback version override exists', async () => {
	const url = `${API}/releases/tags/${PACKAGE}-2.0.85`;
	const net = network(
		{ [url]: release('2.0.85'), [tarball('2.0.85')]: BYTES },
		{
			WALLBOARD_APP_SDK_FALLBACK_VERSION: '2.0.109'
		}
	);
	assert.equal((await resolveSdkTarball('2.0.85', net)).version, '2.0.85');
	assert.deepEqual(net.calls, [NEXUS, url, tarball('2.0.85')]);
});

test('a missing exact release fails without selecting another version', async () => {
	const net = network({ [`${API}/releases/tags/${PACKAGE}-2.0.110`]: new Response('', { status: 404 }) });
	await assert.rejects(resolveSdkTarball('2.0.110', net), /Nexus:.*503.*\nSDK fallback:.*404/);
	assert.equal(net.calls.length, 2);
});

for (const [name, assets, payload, error] of [
	['missing asset', [], BYTES, /needs an uploaded/],
	['missing digest', [{ name: `${PACKAGE}-2.0.109.tgz`, state: 'uploaded' }], BYTES, /SHA-256 digest/],
	['wrong bytes', release('2.0.109').assets, Buffer.from('corrupted tarball'), /Checksum mismatch/]
]) {
	test(`rejects ${name} in the newest release instead of silently using an older SDK`, async () => {
		const net = network({
			[RELEASES]: [release('2.0.109', { assets }), release('2.0.85')],
			[tarball('2.0.109')]: payload
		});
		await assert.rejects(resolveSdkTarball('latest', net), error);
	});
}

test('reports an empty mirror or GitHub API rate limit clearly', async () => {
	await assert.rejects(resolveSdkTarball('latest', network({ [RELEASES]: [] })), /No published stable/);
	await assert.rejects(
		resolveSdkTarball('latest', network({ [RELEASES]: new Response('', { status: 403 }) })),
		/SDK fallback:.*403/
	);
});

test('a custom fallback requires a checksum and preserves the explicit version', async () => {
	const url = 'https://mirror.example.test/sdk.tgz';
	const env = { WALLBOARD_APP_SDK_FALLBACK_URL: url, WALLBOARD_APP_SDK_FALLBACK_VERSION: '2.0.110' };
	await assert.rejects(resolveSdkTarball('2.0.109', network({}, env)), /requires WALLBOARD_APP_SDK_FALLBACK_SHA256/);
	const result = await resolveSdkTarball(
		'2.0.109',
		network(
			{ [url]: BYTES },
			{
				...env,
				WALLBOARD_APP_SDK_FALLBACK_SHA256: SHA256
			}
		)
	);
	assert.equal(result.version, '2.0.109');
});

test('pins the resolved URL while preserving the existing lockfile and unrelated dependencies', async (t) => {
	const directory = await mkdtemp(path.join(os.tmpdir(), 'wallboard-sdk-test-'));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const packagePath = path.join(directory, 'package.json');
	const lockPath = path.join(directory, 'package-lock.json');
	const lock = '{"lockfileVersion":3,"packages":{"node_modules/example":{"version":"1.0.0"}}}\n';
	await writeFile(packagePath, JSON.stringify({ dependencies: { [PACKAGE]: 'old-sdk-url', example: '^1.0.0' } }));
	await writeFile(lockPath, lock);
	await configureSdk('latest', {
		directory,
		...network({ [RELEASES]: [release('2.0.109')], [tarball('2.0.109')]: BYTES })
	});
	const result = JSON.parse(await readFile(packagePath, 'utf8'));
	assert.equal(result.dependencies[PACKAGE], tarball('2.0.109'));
	assert.equal(result.dependencies.example, '^1.0.0');
	assert.equal(result.devDependencies, undefined);
	assert.equal(await readFile(lockPath, 'utf8'), lock);
	const saved = await readFile(packagePath, 'utf8');
	await assert.rejects(configureSdk('latest', { directory, ...network({ [RELEASES]: [] }) }));
	assert.equal(await readFile(packagePath, 'utf8'), saved);
	assert.equal(await readFile(lockPath, 'utf8'), lock);
});
