import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createPageSession } from '../../src/utils/page-session.js';

void describe('page-session capability', (): void => {
	void it('navigates and resets a completed flow', async (): Promise<void> => {
		const changes: string[] = [];
		const controller = createPageSession<'start' | 'questions'>({
			initialView: 'start',
			onViewChange: (view): void => { changes.push(view); }
		});

		controller.navigate('questions');
		controller.completeAfter(5);
		await new Promise((resolve) => setTimeout(resolve, 15));

		assert.equal(controller.getView(), 'start');
		assert.deepEqual(changes, ['questions', 'start']);
		controller.destroy();
	});

	void it('cleans an inactivity timer on destroy', async (): Promise<void> => {
		let resets = 0;
		const controller = createPageSession({
			initialView: 'start',
			inactivityMs: 5,
			onReset: (): void => { resets += 1; },
			onViewChange: (): void => undefined
		});

		controller.destroy();
		await new Promise((resolve) => setTimeout(resolve, 15));
		assert.equal(resets, 0);
	});

	void it('reads the current inactivity duration when activity occurs', async (): Promise<void> => {
		let inactivityMs = 100;
		let resets = 0;
		const controller = createPageSession({
			initialView: 'start',
			inactivityMs: (): number => inactivityMs,
			onReset: (): void => { resets += 1; },
			onViewChange: (): void => undefined
		});

		inactivityMs = 5;
		controller.activity();
		await new Promise((resolve) => setTimeout(resolve, 15));

		assert.equal(resets, 1);
		controller.destroy();
	});
});
