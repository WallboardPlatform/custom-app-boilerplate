import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';

import type { Settings } from '@interfaces/application.interface';
import type { ClockValue } from '@interfaces/clock.interface';

import { formatClockValue } from '@utils/clock';

export const useClock = (settings: Accessor<Settings>): Accessor<ClockValue> => {
	const initialSettings: Settings = settings();
	const [clock, setClock]: [Accessor<ClockValue>, Setter<ClockValue>] = createSignal<ClockValue>(
		formatClockValue(new Date(), initialSettings)
	);
	let timeoutId: number | undefined;

	const updateClock = (): void => {
		setClock(formatClockValue(new Date(), settings()));
	};

	const scheduleTick = (): void => {
		const now: Date = new Date();

		setClock(formatClockValue(now, settings()));
		timeoutId = window.setTimeout(scheduleTick, Math.max(50, 1000 - now.getMilliseconds()));
	};

	createEffect((): void => {
		settings();
		updateClock();
	});

	onMount((): void => {
		scheduleTick();
	});

	onCleanup((): void => {
		if (timeoutId !== undefined) {
			window.clearTimeout(timeoutId);
		}
	});

	return clock;
};
