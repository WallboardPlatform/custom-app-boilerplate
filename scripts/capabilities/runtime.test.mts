import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createInternalDatasourceWriter } from '../../src/utils/internal-datasource.js';
import {
	buildFileSystemMediaIndex,
	findFileSystemMedia,
	normalizeFileSystemMedia,
	resolveCachedMediaUrl,
	resolveMediaFit
} from '../../src/utils/media.js';
import { resolveMotion } from '../../src/utils/motion.js';
import { createTransitionController, type TransitionScheduler } from '../../src/utils/transition.js';

void describe('interactive runtime capabilities', (): void => {
	void it('blocks datasource writes outside the displayer', (): void => {
		let writes = 0;
		const writer = createInternalDatasourceWriter(
			{ isDisplayer: (): boolean => false },
			{
				insertToArray: (): void => { writes += 1; },
				merge: (): void => { writes += 1; },
				set: (): void => { writes += 1; }
			}
		);

		assert.deepEqual(writer.append('results', 'rows', {}), { status: 'editor-blocked' });
		assert.equal(writes, 0);
	});

	void it('reports synchronous datasource failures', (): void => {
		const writer = createInternalDatasourceWriter(
			{ isDisplayer: (): boolean => true },
			{
				insertToArray: (): string => 'Binding not found',
				merge: (): void => undefined,
				set: (): void => undefined
			}
		);

		assert.deepEqual(writer.append('missing', 'rows', {}), { status: 'failed', message: 'Binding not found' });
	});

	void it('resolves coordinated motion and media policies', (): void => {
		assert.equal(resolveMotion('expressive').enabled, true);
		assert.equal(resolveMotion('expressive', true).enabled, false);
		assert.deepEqual(resolveMediaFit('blur-fill'), {
			foregroundFit: 'contain',
			showBlurBackground: true
		});
	});

	void it('normalizes and indexes File System media without requiring a single response wrapper', (): void => {
		const rows = [
			{ name: 'SKU-101.JPG', url: 'https://cdn.example.test/sku-101.jpg' },
			{ name: 'nested/sku-102.png', thumbnailUrl: '/preview/sku-102.png' },
			{ name: 'unsafe.svg', url: 'javascript:alert(1)' }
		];
		const index = buildFileSystemMediaIndex({ content: JSON.stringify(rows) });

		assert.equal(normalizeFileSystemMedia(rows).length, 2);
		assert.equal(findFileSystemMedia(index, 'sku-101')?.name, 'SKU-101.JPG');
		assert.equal(findFileSystemMedia(index, 'SKU-102.PNG')?.url, '/preview/sku-102.png');
	});

	void it('uses platform media caching with a deterministic fallback', async (): Promise<void> => {
		assert.equal(
			await resolveCachedMediaUrl('https://cdn.example.test/item.jpg', (): Promise<string> => Promise.resolve('/cache/item.jpg')),
			'/cache/item.jpg'
		);
		assert.equal(
			await resolveCachedMediaUrl('https://cdn.example.test/item.jpg', (): Promise<string> => Promise.reject(new Error('offline'))),
			'https://cdn.example.test/item.jpg'
		);
		assert.equal(await resolveCachedMediaUrl('javascript:alert(1)', (): string => ''), '');
	});

	void it('cleans up and restarts transitions when pages change rapidly', (): void => {
		let callback: (() => void) | undefined;
		let cleared = 0;
		const states: string[] = [];
		const scheduler: TransitionScheduler = {
			setTimeout: (next): ReturnType<typeof setTimeout> => {
				callback = next;

				return 1 as unknown as ReturnType<typeof setTimeout>;
			},
			clearTimeout: (): void => { cleared += 1; }
		};
		const controller = createTransitionController('page-1', (state): void => {
			states.push(`${state.previousKey ?? '-'}>${state.currentKey}:${state.transitioning}`);
		}, scheduler);

		controller.select('page-2', { enabled: true, durationMs: 280 });
		controller.select('page-3', { enabled: true, durationMs: 280 });
		assert.equal(cleared, 1);
		assert.equal(controller.getState().previousKey, 'page-2');
		callback?.();
		assert.deepEqual(states, [
			'page-1>page-2:true',
			'page-2>page-3:true',
			'->page-3:false'
		]);

		controller.destroy();
		assert.equal(controller.getState().transitioning, false);
	});

	void it('cancels an active transition when motion is switched off', (): void => {
		let cleared = 0;
		const states: boolean[] = [];
		const scheduler: TransitionScheduler = {
			setTimeout: (): ReturnType<typeof setTimeout> => 1 as unknown as ReturnType<typeof setTimeout>,
			clearTimeout: (): void => { cleared += 1; }
		};
		const controller = createTransitionController('page-1', (state): void => {
			states.push(state.transitioning);
		}, scheduler);

		controller.select('page-2', { enabled: true, durationMs: 280 });
		controller.select('page-2', { enabled: false, durationMs: 0 });

		assert.equal(cleared, 1);
		assert.deepEqual(states, [true, false]);
		assert.deepEqual(controller.getState(), {
			currentKey: 'page-2',
			previousKey: null,
			transitioning: false
		});
	});
});
