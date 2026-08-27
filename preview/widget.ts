import { Subject } from 'rxjs';

import previewFixture, { previewScenarios } from './fixture';
import type { PreviewFixture, PreviewScenario } from './fixture.types';
import { installPlatformMock } from './platform-mock';
import type { PlatformMockController, PlatformMockSensorEvent } from './platform-mock';

import configJson from '../src/editor-assets/properties.json';

import './widget.css';

interface WidgetRegistration {
	create: (selector: string, config: unknown, event: Subject<unknown>) => Promise<void>;
	destroy: (appId: string) => Promise<void>;
}

interface PreviewWindow extends Window {
	CustomWidget?: Record<string, WidgetRegistration>;
	__wallboardPreview?: {
		destroy: () => Promise<void>;
		pushConfiguration: (configValues: Record<string, unknown>) => void;
		pushDatasource: (property: string, value: unknown) => void;
		pushExternalCommand: (command: string, parameters?: Array<{ parameter: string; value: string | number | boolean }>) => void;
		pushSensorEvent: (event: PlatformMockSensorEvent) => void;
		platform: PlatformMockController;
	};
}

const PREVIEW_ROOT_ID = 'wallboard-preview-root';
const PREVIEW_ROOT_SELECTOR = `#${PREVIEW_ROOT_ID}`;

const applyBackground = (): void => {
	const params: URLSearchParams = new URLSearchParams(window.location.search);
	const background: string = params.get('background') || 'checker';

	document.body.dataset.previewBackground = background;
};

const markReady = (): void => {
	window.requestAnimationFrame((): void => {
		window.requestAnimationFrame((): void => {
			document.documentElement.dataset.previewReady = 'true';
		});
	});
};

const showFailure = (error: unknown): void => {
	const message: string = error instanceof Error ? error.stack || error.message : String(error);
	const root: HTMLElement | null = document.getElementById('wallboard-preview-root');

	document.documentElement.dataset.previewError = message;

	if (root) {
		root.innerHTML = '';
		const output: HTMLPreElement = document.createElement('pre');
		output.className = 'preview-error';
		output.textContent = message;
		root.append(output);
	}
};

const mountWidget = async (): Promise<void> => {
	applyBackground();
	const params: URLSearchParams = new URLSearchParams(window.location.search);
	const scenarioId: string | null = params.get('scenario');
	const scenario: PreviewScenario | undefined = previewScenarios.find(
		(candidate: PreviewScenario): boolean => candidate.id === scenarioId
	);
	const fixture: PreviewFixture = scenario?.fixture ?? previewFixture;
	// '?sensorSource=unavailable' reproduces the editor / a client without the sensor bridge
	// without having to declare a dedicated scenario.
	const sensorSourceOverride: string | null = params.get('sensorSource');
	const platform: PlatformMockController = installPlatformMock({
		...fixture.platform,
		...(sensorSourceOverride === 'available' || sensorSourceOverride === 'unavailable'
			? { sensorSource: sensorSourceOverride }
			: {})
	});

	await import('../src/index');

	const previewWindow: PreviewWindow = window;
	const applicationName: string = `${configJson.name}_${configJson.version}`;
	const registration: WidgetRegistration | undefined = previewWindow.CustomWidget?.[applicationName];

	if (!registration) {
		throw new Error(`Custom widget registration '${applicationName}' was not created.`);
	}

	const eventSubject: Subject<unknown> = new Subject<unknown>();
	let currentConfigValues: Record<string, unknown> = { ...fixture.configValues };
	previewWindow.__wallboardPreview = {
		platform,
		destroy: async (): Promise<void> => {
			eventSubject.complete();
			await registration.destroy(PREVIEW_ROOT_ID);
		},
		pushConfiguration: (configValues: Record<string, unknown>): void => {
			currentConfigValues = { ...currentConfigValues, ...configValues };
			eventSubject.next({
				messageType: 'sendConfiguration',
				configValues: currentConfigValues
			});
		},
		pushDatasource: (property: string, value: unknown): void => {
			eventSubject.next({
				messageType: 'boundDataChanged',
				changedProperty: property,
				newValue: value
			});
		},
		pushExternalCommand: (
			command: string,
			parameters?: Array<{ parameter: string; value: string | number | boolean }>
		): void => {
			eventSubject.next({
				messageType: 'triggerCustomCommand',
				customAppCommandParameters: { command, parameters }
			});
		},
		// Incoming sensor events arrive on the displayer's global bridge, not on the widget
		// event stream, so they are delivered through the platform mock.
		pushSensorEvent: (event: PlatformMockSensorEvent): void => {
			platform.emitSensorEvent(event);
		}
	};
	const config: Record<string, unknown> = {
		...fixture.additionalConfig,
		id: fixture.id,
		configValues: currentConfigValues,
		dataPickerValues: fixture.dataPickerValues,
		datasourceIds: fixture.datasourceIds
	};

	await registration.create(PREVIEW_ROOT_SELECTOR, config, eventSubject);
	markReady();
};

void mountWidget().catch((error: unknown): void => {
	showFailure(error);
	throw error;
});
