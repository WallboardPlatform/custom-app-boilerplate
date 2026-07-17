import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createRotationController, type RotationScheduler } from '../../src/utils/rotation.js';

interface FakeTimer {
	callback: () => void;
	interval: number;
	cleared: boolean;
}

const fakeScheduler = (): { scheduler: RotationScheduler; timers: FakeTimer[] } => {
	const timers: FakeTimer[] = [];

	return {
		timers,
		scheduler: {
			setInterval: (callback: () => void, interval: number): FakeTimer => {
				const timer = { callback, interval, cleared: false };
				timers.push(timer);

				return timer;
			},
			clearInterval: (handle: unknown): void => {
				(handle as FakeTimer).cleared = true;
			}
		}
	};
};

void describe('rotation capability', () => {
	void it('does not schedule empty or single-key rotations', () => {
		const { scheduler, timers } = fakeScheduler();
		const changes: string[] = [];
		const rotation = createRotationController((key: string): number => changes.push(key), scheduler);

		rotation.sync([], undefined, 1000);
		rotation.sync(['only'], undefined, 1000);

		assert.deepEqual(changes, ['only']);
		assert.equal(timers.length, 0);
	});

	void it('preserves an active key and advances circularly', () => {
		const { scheduler, timers } = fakeScheduler();
		const changes: string[] = [];
		const rotation = createRotationController((key: string): number => changes.push(key), scheduler);

		rotation.sync(['alpha', 'bravo', 'charlie'], 'bravo', 2400);
		assert.deepEqual(changes, []);
		assert.equal(timers[0].interval, 2400);

		timers[0].callback();
		timers[0].callback();
		assert.deepEqual(changes, ['charlie', 'alpha']);
	});

	void it('falls back safely after data changes and clears timers on destroy', () => {
		const { scheduler, timers } = fakeScheduler();
		const changes: string[] = [];
		const rotation = createRotationController((key: string): number => changes.push(key), scheduler);

		rotation.sync(['alpha', 'bravo'], 'bravo', 1000);
		rotation.sync(['charlie', 'delta'], 'bravo', 2000);

		assert.equal(timers[0].cleared, true);
		assert.deepEqual(changes, ['charlie']);

		rotation.destroy();
		assert.equal(timers[1].cleared, true);
	});

	void it('retains the current key when live data reorders pages', () => {
		const { scheduler } = fakeScheduler();
		const changes: Array<{ key: string; index: number }> = [];
		const rotation = createRotationController((key: string, index: number): number => {
			return changes.push({ key, index });
		}, scheduler);

		rotation.sync(['alpha', 'bravo'], 'bravo', 1000);
		rotation.sync(['bravo', 'charlie'], 'charlie', 1000);

		assert.deepEqual(changes, [{ key: 'bravo', index: 0 }]);
	});
});
