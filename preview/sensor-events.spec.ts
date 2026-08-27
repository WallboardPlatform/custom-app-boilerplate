import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

interface SensorBridgeWindow extends Window {
	__wallboardPreview?: {
		pushSensorEvent: (event: { id?: string; event?: string; value?: unknown }) => void;
		platform: {
			sensorEventListenerCount: () => number;
		};
	};
	customScriptAPI?: {
		interaction?: {
			addSensorEventListener?: (listener: (event: unknown) => void) => void;
			removeSensorEventListener?: (listener: (event: unknown) => void) => void;
		};
	};
	__sensorProbe?: {
		received: unknown[];
		listener: (event: unknown) => void;
		dispose: () => void;
	};
}

const openPreview = async (page: Page, query: string = ''): Promise<void> => {
	const response = await page.goto(`/preview/widget.html?background=checker${query}`);

	expect(response?.ok()).toBe(true);
	await page.waitForFunction((): boolean => document.documentElement.dataset.previewReady === 'true');
};

/**
 * Registers a probe on the sensor bridge exactly the way `useSensorEventListener` does, so the
 * preview contract the hook depends on is covered without instrumenting the starter app.
 */
const installSensorProbe = async (page: Page): Promise<void> => {
	await page.evaluate((): void => {
		const previewWindow = window as SensorBridgeWindow;
		const interaction = previewWindow.customScriptAPI?.interaction;

		if (!interaction?.addSensorEventListener || !interaction.removeSensorEventListener) {
			throw new Error('Preview sensor bridge is unavailable.');
		}

		const received: unknown[] = [];
		const listener = (event: unknown): void => {
			received.push(event);
		};

		interaction.addSensorEventListener(listener);

		previewWindow.__sensorProbe = {
			received,
			listener,
			dispose: (): void => {
				interaction.removeSensorEventListener?.(listener);
			}
		};
	});
};

const readProbe = async (page: Page): Promise<unknown[]> => {
	return page.evaluate((): unknown[] => {
		return (window as SensorBridgeWindow).__sensorProbe?.received ?? [];
	});
};

const pushSensorEvent = async (
	page: Page,
	event: { id?: string; event?: string; value?: unknown }
): Promise<void> => {
	await page.evaluate((payload): void => {
		const previewWindow = window as SensorBridgeWindow;

		if (!previewWindow.__wallboardPreview) {
			throw new Error('Preview sensor bridge is unavailable.');
		}

		previewWindow.__wallboardPreview.pushSensorEvent(payload);
	}, event);
};

test('preview bridge exposes the sensor event entry point', async ({ page }): Promise<void> => {
	await openPreview(page);

	const bridge = await page.evaluate((): { push: string; add: string; remove: string } => {
		const previewWindow = window as SensorBridgeWindow;

		return {
			push: typeof previewWindow.__wallboardPreview?.pushSensorEvent,
			add: typeof previewWindow.customScriptAPI?.interaction?.addSensorEventListener,
			remove: typeof previewWindow.customScriptAPI?.interaction?.removeSensorEventListener
		};
	});

	expect(bridge).toEqual({ push: 'function', add: 'function', remove: 'function' });
});

test('pushed sensor events reach every registered listener unchanged', async ({ page }): Promise<void> => {
	await openPreview(page);
	await installSensorProbe(page);

	await pushSensorEvent(page, { id: 'X001A', event: 'motion', value: '1' });
	await pushSensorEvent(page, { id: 'app-instance', event: 'checkout', value: { total: 42 } });

	expect(await readProbe(page)).toEqual([
		{ id: 'X001A', event: 'motion', value: '1' },
		{ id: 'app-instance', event: 'checkout', value: { total: 42 } }
	]);
});

test('a removed listener stops receiving sensor events', async ({ page }): Promise<void> => {
	await openPreview(page);
	await installSensorProbe(page);

	const registeredCount: number = await page.evaluate((): number => {
		return (window as SensorBridgeWindow).__wallboardPreview?.platform.sensorEventListenerCount() ?? -1;
	});

	expect(registeredCount).toBe(1);

	await pushSensorEvent(page, { id: 'X001A', event: 'motion', value: '1' });
	await page.evaluate((): void => {
		(window as SensorBridgeWindow).__sensorProbe?.dispose();
	});
	await pushSensorEvent(page, { id: 'X001A', event: 'motion', value: '0' });

	expect(await readProbe(page)).toEqual([{ id: 'X001A', event: 'motion', value: '1' }]);

	const remainingCount: number = await page.evaluate((): number => {
		return (window as SensorBridgeWindow).__wallboardPreview?.platform.sensorEventListenerCount() ?? -1;
	});

	expect(remainingCount).toBe(0);
});

test('sensorSource=unavailable hides the sensor bridge', async ({ page }): Promise<void> => {
	await openPreview(page, '&sensorSource=unavailable');

	const interactionType: string = await page.evaluate((): string => {
		return typeof (window as SensorBridgeWindow).customScriptAPI?.interaction;
	});

	expect(interactionType).toBe('undefined');
});