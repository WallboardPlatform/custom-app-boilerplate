import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { applyCapability } from '../capability-materialization.mjs';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const temporaryDirectories: string[] = [];

type TestTarget = { id: string; kind: 'building' | 'destination' };

interface TestViewerState {
	dimension: '2d' | '3d';
	language: string;
	mode: 'journey' | 'route' | 'site';
	originId?: string;
	profile: 'standard' | 'step-free';
	target?: TestTarget;
}

interface TestViewerOptions {
	onStateChange?: (state: TestViewerState) => void;
}

interface TestViewer {
	assets: readonly unknown[];
	buildings: readonly unknown[];
	destinations: ReadonlyArray<{ id: string; name: string }>;
	destroy(): void;
	guidanceSupported: boolean;
	guidanceText(): string;
	languages: ReadonlyArray<{ code: string; label: string }>;
	levels: ReadonlyArray<{ id: string; name: string; role: 'building-floor' | 'site' | 'standalone' }>;
	origins: ReadonlyArray<{ id: string; label: string; levelId: string; screenId: string }>;
	previewRoute(target: TestTarget): boolean;
	projectName: string;
	replay(options?: { speak?: boolean }): void;
	resetCamera(): void;
	setDimension(dimension: '2d' | '3d'): void;
	setLanguage(language: string): void;
	setOrigin(originId: string): void;
	setProfile(profile: 'standard' | 'step-free'): void;
	showSite(): void;
	speakGuidance(): void;
	startJourney(target: TestTarget, options?: { speak?: boolean }): boolean;
	readonly state: TestViewerState;
	stopGuidance(): void;
}

interface TestHarnessDependencies {
	createViewer(host: HTMLElement, archive: Uint8Array, options: TestViewerOptions): TestViewer;
	readSource(source: unknown): Promise<Uint8Array>;
}

interface TestHarnessSnapshot {
	catalog?: { projectName: string };
	notice?: string;
	status: string;
	viewerState?: TestViewerState;
}

interface TestHarness {
	readonly catalog: { projectName: string } | undefined;
	readonly snapshot: TestHarnessSnapshot;
	destroy(): void;
	load(source: unknown): Promise<boolean>;
	previewRoute(target: TestTarget): boolean;
	replay(options?: { speak?: boolean }): void;
	reset(): void;
	startJourney(options?: { speak?: boolean }): boolean;
}

interface TestHarnessOptions {
	onSnapshot?: (snapshot: TestHarnessSnapshot) => void;
	resolveTargetAvailability?: (target: TestTarget) => { available: boolean; message?: string };
}

type TestHarnessController = new (
	host: HTMLElement,
	options: TestHarnessOptions,
	dependencies: TestHarnessDependencies
) => TestHarness;

const loadHarnessController = async (): Promise<TestHarnessController> => {
	const targetDirectory = temporaryDirectory('wallboard-wayfinding-runtime-');
	fs.writeFileSync(path.join(targetDirectory, 'package.json'), `${JSON.stringify({
		name: 'wayfinding-runtime-test',
		type: 'module'
	}, null, '\t')}\n`);
	applyCapability({ capabilityId: 'wayfinding', rootDirectory, targetDirectory });
	const sourcePath = path.join(
		targetDirectory,
		'src',
		'capabilities',
		'wayfinding',
		'vendor',
		'wayfinding-viewer.js'
	);
	const browserGlobal = globalThis as unknown as { window?: { document: { addEventListener(): void } } };
	const previousWindow = browserGlobal.window;
	let module: { WayfindingHarnessController: TestHarnessController };

	try {
		browserGlobal.window = { document: { addEventListener: (): void => undefined } };
		module = await import(pathToFileURL(sourcePath).href) as {
			WayfindingHarnessController: TestHarnessController;
		};
	} finally {
		if (previousWindow) browserGlobal.window = previousWindow;
		else delete browserGlobal.window;
	}

	return module.WayfindingHarnessController;
};

const temporaryDirectory = (prefix: string): string => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	temporaryDirectories.push(directory);

	return directory;
};

const sha256 = (file: string): string => crypto
	.createHash('sha256')
	.update(fs.readFileSync(file))
	.digest('hex');

afterEach((): void => {
	for (const directory of temporaryDirectories.splice(0)) {
		fs.rmSync(directory, { force: true, recursive: true });
	}
});

void describe('Wayfinding capability materialization', (): void => {
	void it('expands one checksum-pinned Editor viewer release into an opted-in app', (): void => {
		const targetDirectory = temporaryDirectory('wallboard-wayfinding-capability-');
		fs.writeFileSync(
			path.join(targetDirectory, 'package.json'),
			`${JSON.stringify({ name: 'wayfinding-target' }, null, '\t')}\n`
		);

		applyCapability({ capabilityId: 'wayfinding', rootDirectory, targetDirectory });

		const packageDocument = JSON.parse(fs.readFileSync(
			path.join(targetDirectory, 'package.json'),
			'utf8'
		)) as { wallboardCapabilities?: string[] };
		const vendorDirectory = path.join(targetDirectory, 'src', 'capabilities', 'wayfinding', 'vendor');
		const manifest = JSON.parse(fs.readFileSync(
			path.join(vendorDirectory, 'manifest.json'),
			'utf8'
		)) as {
			files: {
				declaration: { path: string; sha256: string };
				module: { path: string; sha256: string };
			};
			format: string;
			formatVersion: number;
			viewerVersion: string;
		};

		assert.deepEqual(packageDocument.wallboardCapabilities, ['wayfinding']);
		assert.equal(manifest.format, 'wallboard-wayfinding-viewer');
		assert.equal(manifest.formatVersion, 1);
		assert.equal(manifest.viewerVersion, '1.4.1');
		assert.equal(
			sha256(path.join(vendorDirectory, manifest.files.module.path)),
			manifest.files.module.sha256
		);
		assert.equal(
			sha256(path.join(vendorDirectory, manifest.files.declaration.path)),
			manifest.files.declaration.sha256
		);
		assert.doesNotThrow((): void => {
			applyCapability({ capabilityId: 'wayfinding', rootDirectory, targetDirectory });
		});
	});
});

void describe('Wayfinding harness lifecycle', (): void => {
	void it('enforces 2D route preview before the visitor-triggered 3D journey', async (): Promise<void> => {
		const WayfindingHarnessController = await loadHarnessController();
		let viewerOptions: TestViewerOptions | undefined;
		let available = false;
		let destroyed = false;
		let replayed = false;
		let spoken: boolean | undefined;
		let state: TestViewerState = {
			dimension: '2d' as const,
			language: 'en',
			mode: 'site' as const,
			originId: 'origin-1',
			profile: 'standard' as const
		};
		const viewer: TestViewer = {
			assets: [],
			buildings: [],
			destinations: [{ id: 'destination-1', name: 'Reception' }],
			destroy: (): void => { destroyed = true; },
			guidanceSupported: true,
			guidanceText: (): string => state.mode === 'site' ? '' : 'Continue to reception.',
			languages: [{ code: 'en', label: 'English' }],
			levels: [{ id: 'site', name: 'Campus', role: 'site' as const }],
			origins: [{ id: 'origin-1', label: 'Lobby', levelId: 'site', screenId: 'screen-1' }],
			previewRoute: (target: { id: string; kind: 'building' | 'destination' }): boolean => {
				state = { ...state, mode: 'route' as const, target };
				viewerOptions?.onStateChange?.(state);

				return true;
			},
			projectName: 'Synthetic campus',
			replay: (): void => { replayed = true; },
			resetCamera: (): void => undefined,
			setDimension: (): void => undefined,
			setLanguage: (): void => undefined,
			setOrigin: (): void => undefined,
			setProfile: (): void => undefined,
			showSite: (): void => {
				state = { ...state, mode: 'site' as const, target: undefined };
				viewerOptions?.onStateChange?.(state);
			},
			speakGuidance: (): void => undefined,
			startJourney: (target: { id: string; kind: 'building' | 'destination' }, options?: { speak?: boolean }): boolean => {
				spoken = options?.speak;
				state = { ...state, dimension: '3d' as const, mode: 'journey' as const, target };
				viewerOptions?.onStateChange?.(state);

				return true;
			},
			get state() { return state; },
			stopGuidance: (): void => undefined
		};
		const snapshots: string[] = [];
		const dependencies: TestHarnessDependencies = {
			createViewer: (_host, _archive, options): TestViewer => {
				viewerOptions = options;

				return viewer;
			},
			readSource: (): Promise<Uint8Array> => Promise.resolve(new Uint8Array([1, 2, 3]))
		};
		const harness = new WayfindingHarnessController({} as HTMLElement, {
			onSnapshot: (snapshot): void => { snapshots.push(snapshot.status); },
			resolveTargetAvailability: (): { available: boolean; message?: string } => ({
				available,
				message: available ? undefined : 'Reception is closed.'
			})
		}, dependencies);

		assert.equal(await harness.load(new Uint8Array([7])), true);
		assert.equal(harness.snapshot.status, 'ready');
		assert.equal(harness.catalog?.projectName, 'Synthetic campus');
		assert.equal(harness.previewRoute({ id: 'destination-1', kind: 'destination' }), true);
		assert.equal(harness.snapshot.viewerState?.mode, 'route');
		assert.equal(harness.startJourney(), false);
		assert.equal(harness.snapshot.notice, 'Reception is closed.');

		available = true;
		assert.equal(harness.startJourney(), true);
		assert.equal(harness.snapshot.viewerState?.mode, 'journey');
		assert.equal(harness.snapshot.viewerState?.dimension, '3d');
		assert.equal(spoken, true);
		harness.replay({ speak: true });
		assert.equal(replayed, true);
		harness.reset();
		assert.equal(harness.snapshot.viewerState?.mode, 'site');
		harness.destroy();
		assert.equal(destroyed, true);
		assert.equal(harness.snapshot.status, 'destroyed');
		assert.deepEqual(snapshots.includes('loading'), true);
	});

	void it('drops stale asynchronous map loads and destroys their viewers', async (): Promise<void> => {
		const WayfindingHarnessController = await loadHarnessController();
		let resolveSlow!: (archive: Uint8Array) => void;
		const slow = new Promise<Uint8Array>((resolve): void => { resolveSlow = resolve; });
		let created = 0;
		const viewer: TestViewer = {
			assets: [], buildings: [], destinations: [], destroy: (): void => undefined,
			guidanceSupported: false, guidanceText: (): string => '', languages: [], levels: [], origins: [],
			previewRoute: (): boolean => false, projectName: 'Fast map', replay: (): void => undefined,
			resetCamera: (): void => undefined, setDimension: (): void => undefined,
			setLanguage: (): void => undefined, setOrigin: (): void => undefined,
			setProfile: (): void => undefined, showSite: (): void => undefined,
			speakGuidance: (): void => undefined,
			startJourney: (): boolean => false,
			state: { dimension: '2d', language: 'en', mode: 'site', profile: 'standard' },
			stopGuidance: (): void => undefined
		};
		const dependencies: TestHarnessDependencies = {
			createViewer: (): TestViewer => {
				created += 1;

				return viewer;
			},
			readSource: (source): Promise<Uint8Array> => source === 'slow'
				? slow
				: Promise.resolve(new Uint8Array([2]))
		};
		const harness = new WayfindingHarnessController({} as HTMLElement, {}, dependencies);
		const slowLoad = harness.load('slow');
		const fastLoad = harness.load('fast');

		assert.equal(await fastLoad, true);
		resolveSlow(new Uint8Array([1]));
		assert.equal(await slowLoad, false);
		assert.equal(created, 1);
		assert.equal(harness.catalog?.projectName, 'Fast map');
		harness.destroy();
	});
});
