import { createWayfindingViewerFromArchive } from './vendor/wayfinding-viewer.js';

import {
	WayfindingHarnessController,
	type WayfindingHarness,
	type WayfindingHarnessDependencies,
	type WayfindingHarnessOptions,
	type WayfindingMapSource
} from './harness-core';

export const readWayfindingMapSource = async (source: WayfindingMapSource): Promise<Uint8Array> => {
	const resolved = typeof source === 'function' ? await source() : source;

	if (resolved instanceof Uint8Array) return resolved;

	if (resolved instanceof ArrayBuffer) return new Uint8Array(resolved);

	const response = await fetch(resolved);

	if (!response.ok) throw new Error(`Published wayfinding map request failed (${response.status}).`);

	return new Uint8Array(await response.arrayBuffer());
};

const browserDependencies: WayfindingHarnessDependencies = {
	createViewer: createWayfindingViewerFromArchive,
	readSource: readWayfindingMapSource
};

export const createWayfindingHarness = (
	host: HTMLElement,
	options: WayfindingHarnessOptions = {},
	dependencies: WayfindingHarnessDependencies = browserDependencies
): WayfindingHarness => new WayfindingHarnessController(host, options, dependencies);
