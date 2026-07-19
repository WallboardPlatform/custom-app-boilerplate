import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { applyCapability } from '../capability-materialization.mjs';
import { materializeExample } from '../example-materialization.mjs';

interface VideoSource {
	captions?: Array<{ default?: boolean }>;
	id: string;
	name: string;
	url: string;
}

interface VideoSourceModule {
	isHlsSource: (source: VideoSource | undefined) => boolean;
	normalizeFolderId: (value: unknown) => string;
	normalizeVideoPlaylist: (value: unknown) => VideoSource[];
	normalizeVideoSelection: (value: unknown, fallbackId?: string) => VideoSource | undefined;
	resolveVideoSources: (options: Record<string, unknown>) => Promise<VideoSource[]>;
}

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hasVideoCapabilityCatalog = fs.existsSync(
	path.join(rootDirectory, 'capabilities', 'video', 'capability.json')
);
const videoSourceImport = hasVideoCapabilityCatalog
	? '../../capabilities/video/overlay/src/capabilities/video/source.js'
	: '../../src/capabilities/video/source.js';
const videoSourceModule = await import(videoSourceImport) as unknown as VideoSourceModule;
const { isHlsSource, normalizeFolderId, normalizeVideoPlaylist, normalizeVideoSelection, resolveVideoSources } = videoSourceModule;
const temporaryDirectories: string[] = [];

const temporaryDirectory = (prefix: string): string => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	temporaryDirectories.push(directory);

	return directory;
};

const writeJson = (filePath: string, value: unknown): void => {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, '\t')}\n`);
};

afterEach((): void => {
	for (const directory of temporaryDirectories.splice(0)) fs.rmSync(directory, { force: true, recursive: true });
});

void describe('video capability', (): void => {
	void it('normalizes direct, serialized, and wrapped playlists without duplicate URLs', (): void => {
		assert.deepEqual(normalizeVideoSelection('https://cdn.example.test/intro.mp4'), {
			id: 'video',
			name: 'intro.mp4',
			url: 'https://cdn.example.test/intro.mp4'
		});

		const playlist = normalizeVideoPlaylist(JSON.stringify({
			items: [
				{ id: 'intro', title: 'Opening', url: 'https://cdn.example.test/intro.mp4' },
				{ id: 'duplicate', src: 'https://cdn.example.test/intro.mp4' },
				{
					id: 'feature',
					location: 'https://cdn.example.test/feature.m3u8',
					tracks: [{ src: 'https://cdn.example.test/feature-en.vtt', label: 'English', language: 'en', default: true }]
				}
			]
		}));

		assert.equal(playlist.length, 2);
		assert.equal(playlist[1].captions?.[0].default, true);
		assert.equal(isHlsSource(playlist[1]), true);
		assert.equal(normalizeFolderId({ folderId: 'videos-42' }), 'videos-42');
	});

	void it('resolves folders through the VIDEO API and caches every media surface', async (): Promise<void> => {
		const calls: unknown[][] = [];
		const cached: string[] = [];
		const api = {
			cacheFile: (url: string): Promise<string> => {
				cached.push(url);

				return Promise.resolve(`/cached/${url.split('/').pop()}`);
			},
			getFilesFromFolder: (...args: unknown[]): Promise<unknown[]> => {
				calls.push(args);

				return Promise.resolve([{
					cacheCheckedSource: 'https://cdn.example.test/open.mp4',
					contentType: 'VIDEO', customerId: 1, id: 'open', location: 'https://cdn.example.test/open.mp4', name: 'Open.mp4'
				}]);
			}
		};

		const sources = await resolveVideoSources({
			api,
			folder: { id: 'folder-1' },
			recursive: false,
			sourceMode: 'folder'
		});

		assert.deepEqual(calls, [['folder-1', 'VIDEO', false]]);
		assert.equal(sources[0].url, '/cached/open.mp4');
		assert.deepEqual(cached, ['https://cdn.example.test/open.mp4']);
	});

	void it('materializes the pinned HLS fallback only into opted-in apps', {
		skip: !hasVideoCapabilityCatalog
	}, (): void => {
		const targetDirectory = temporaryDirectory('wallboard-video-capability-');
		writeJson(path.join(targetDirectory, 'package.json'), { name: 'video-target' });

		applyCapability({ capabilityId: 'video', rootDirectory, targetDirectory });

		const packageJson = JSON.parse(fs.readFileSync(path.join(targetDirectory, 'package.json'), 'utf8'));
		const runtimePath = path.join(targetDirectory, 'src', 'capabilities', 'video', 'vendor', 'hls.min.js');
		assert.deepEqual(packageJson.wallboardCapabilities, ['video']);
		assert.ok(fs.statSync(runtimePath).size > 200_000);
		assert.match(fs.readFileSync(runtimePath, 'utf8'), /0\.7\.9/);
	});

	void it('keeps ordinary materialized apps free of video runtime and vendor code', (): void => {
		const fixtureRoot = temporaryDirectory('wallboard-no-video-source-');
		const targetDirectory = temporaryDirectory('wallboard-no-video-target-');
		writeJson(path.join(fixtureRoot, 'package.json'), { name: 'plain-boilerplate' });
		fs.mkdirSync(path.join(fixtureRoot, 'src'), { recursive: true });
		fs.writeFileSync(path.join(fixtureRoot, 'src', 'index.ts'), 'export const base = true;\n');
		writeJson(path.join(fixtureRoot, 'examples', 'plain', 'example.json'), { id: 'plain', title: 'Plain app' });
		fs.mkdirSync(path.join(fixtureRoot, 'examples', 'plain', 'overlay', 'src'), { recursive: true });
		fs.writeFileSync(path.join(fixtureRoot, 'examples', 'plain', 'overlay', 'src', 'app.ts'), 'export const app = true;\n');
		fs.mkdirSync(path.join(fixtureRoot, 'capabilities', 'video'), { recursive: true });
		fs.writeFileSync(path.join(fixtureRoot, 'capabilities', 'video', 'sentinel.js'), 'VIDEO_SENTINEL\n');

		materializeExample({ exampleId: 'plain', rootDirectory: fixtureRoot, targetDirectory });

		const packageJson = JSON.parse(fs.readFileSync(path.join(targetDirectory, 'package.json'), 'utf8'));
		assert.equal(packageJson.wallboardCapabilities, undefined);
		assert.equal(fs.existsSync(path.join(targetDirectory, 'src', 'capabilities', 'video')), false);
		assert.equal(fs.readFileSync(path.join(targetDirectory, 'src', 'index.ts'), 'utf8').includes('VIDEO_SENTINEL'), false);
	});
});
