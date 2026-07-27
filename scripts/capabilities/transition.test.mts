import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTransitionController } from '../../src/utils/transition.ts';
import type { TransitionScheduler, TransitionState } from '../../src/utils/transition.ts';

/**
 * `transition` had no tests and no consumer. That is the shape `text-fit` had when it silently
 * pinned every auto-fitted string to its floor for months: the first app to reach for it would
 * have been the one debugging it. These cover the controller before that happens.
 */

type ScheduledCallback = () => void;

interface FakeClock {
	pending: number;
	run: ScheduledCallback;
	scheduler: TransitionScheduler;
}

const fakeClock = (): FakeClock => {
	const callbacks = new Map<number, ScheduledCallback>();
	let nextId = 1;

	return {
		get pending(): number {
			return callbacks.size;
		},
		run: (): void => {
			const due: ScheduledCallback[] = [...callbacks.values()];

			callbacks.clear();

			for (const callback of due) callback();
		},
		scheduler: {
			setTimeout: (callback: () => void): ReturnType<typeof setTimeout> => {
				nextId += 1;

				const id: number = nextId;

				callbacks.set(id, callback);

				return id as unknown as ReturnType<typeof setTimeout>;
			},
			clearTimeout: (timer: ReturnType<typeof setTimeout>): void => {
				callbacks.delete(timer as unknown as number);
			}
		}
	};
};

const track = (): { states: TransitionState[]; onChange: (state: TransitionState) => void } => {
	const states: TransitionState[] = [];

	return { states, onChange: (state: TransitionState): void => void states.push({ ...state }) };
};

void describe('transition controller', (): void => {
	void it('holds the previous key only while a transition is running', (): void => {
		const clock: FakeClock = fakeClock();
		const { states, onChange } = track();
		const controller = createTransitionController('a', onChange, clock.scheduler);

		controller.select('b', { enabled: true, durationMs: 300 });

		assert.deepEqual(controller.getState(), { currentKey: 'b', previousKey: 'a', transitioning: true });
		clock.run();
		assert.deepEqual(controller.getState(), { currentKey: 'b', previousKey: null, transitioning: false });
		assert.equal(states.length, 2);
	});

	void it('changes instantly when motion is off', (): void => {
		// Progression must continue with motion Off, without a lingering transitioning flag.
		const clock: FakeClock = fakeClock();
		const { onChange } = track();
		const controller = createTransitionController('a', onChange, clock.scheduler);

		controller.select('b', { enabled: false, durationMs: 300 });

		assert.deepEqual(controller.getState(), { currentKey: 'b', previousKey: null, transitioning: false });
		assert.equal(clock.pending, 0, 'motion off must not schedule a timer');
	});

	void it('treats a zero duration as motion off', (): void => {
		const clock: FakeClock = fakeClock();
		const { onChange } = track();
		const controller = createTransitionController('a', onChange, clock.scheduler);

		controller.select('b', { enabled: true, durationMs: 0 });

		assert.equal(controller.getState().transitioning, false);
		assert.equal(clock.pending, 0);
	});

	void it('ignores reselecting the key already shown', (): void => {
		const clock: FakeClock = fakeClock();
		const { states, onChange } = track();
		const controller = createTransitionController('a', onChange, clock.scheduler);

		controller.select('a', { enabled: true, durationMs: 300 });

		assert.equal(states.length, 0, 'reselecting the current key must not publish a change');
	});

	void it('replaces an in-flight transition instead of stacking timers', (): void => {
		// Rotation faster than the transition would otherwise leave orphaned timers that resolve
		// onto a key the app has already moved past.
		const clock: FakeClock = fakeClock();
		const { onChange } = track();
		const controller = createTransitionController('a', onChange, clock.scheduler);

		controller.select('b', { enabled: true, durationMs: 300 });
		controller.select('c', { enabled: true, durationMs: 300 });

		assert.equal(clock.pending, 1, 'a superseded transition must not leave its timer behind');
		assert.deepEqual(controller.getState(), { currentKey: 'c', previousKey: 'b', transitioning: true });
		clock.run();
		assert.equal(controller.getState().currentKey, 'c');
	});

	void it('settles an in-flight transition when motion is turned off mid-flight', (): void => {
		const clock: FakeClock = fakeClock();
		const { onChange } = track();
		const controller = createTransitionController('a', onChange, clock.scheduler);

		controller.select('b', { enabled: true, durationMs: 300 });
		controller.select('b', { enabled: false, durationMs: 300 });

		assert.deepEqual(controller.getState(), { currentKey: 'b', previousKey: null, transitioning: false });
		assert.equal(clock.pending, 0);
	});

	void it('clears its timer on destroy', (): void => {
		const clock: FakeClock = fakeClock();
		const { onChange } = track();
		const controller = createTransitionController('a', onChange, clock.scheduler);

		controller.select('b', { enabled: true, durationMs: 300 });
		controller.destroy();

		assert.equal(clock.pending, 0, 'destroy must not leave a timer running');
		assert.equal(controller.getState().transitioning, false);
	});
});
