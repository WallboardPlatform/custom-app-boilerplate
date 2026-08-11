import { createEffect, createSignal, onCleanup, onMount, type JSX } from 'solid-js';

import {
	createWayfindingHarness
} from './harness';
import type {
	WayfindingHarness,
	WayfindingHarnessOptions,
	WayfindingHarnessSnapshot,
	WayfindingMapSource
} from './harness-core';

import style from './wayfinding-viewport.module.scss';

export interface WayfindingViewportProps {
	class?: string;
	onHarness?: (harness: WayfindingHarness) => void;
	options?: WayfindingHarnessOptions;
	source: WayfindingMapSource;
}

export const WayfindingViewport = (props: WayfindingViewportProps): JSX.Element => {
	let host!: HTMLDivElement;
	let harness: WayfindingHarness | undefined;
	const [snapshot, setSnapshot] = createSignal<WayfindingHarnessSnapshot>({ status: 'idle' });

	onMount((): void => {
		harness = createWayfindingHarness(host, {
			...props.options,
			onSnapshot: (next): void => {
				setSnapshot(next);
				props.options?.onSnapshot?.(next);
			}
		});
		props.onHarness?.(harness);
		createEffect((): void => {
			const source = props.source;

			void harness?.load(source);
		});
	});

	onCleanup((): void => harness?.destroy());

	return (
		<div
			ref={host}
			class={`${style.viewport}${props.class ? ` ${props.class}` : ''}`}
			data-wayfinding-harness-status={snapshot().status}
			data-wayfinding-stage
		/>
	);
};
