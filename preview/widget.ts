import { Subject } from 'rxjs';

import previewFixture, { previewScenarios } from './fixture';
import type { PreviewFixture, PreviewScenario } from './fixture';
import { installPlatformMock } from './platform-mock';

import configJson from '../src/editor-assets/properties.json';

import './widget.css';

interface WidgetRegistration {
	create: (selector: string, config: unknown, event: Subject<unknown>) => Promise<void>;
	destroy: (appId: string) => Promise<void>;
}

interface PreviewWindow extends Window {
	CustomWidget?: Record<string, WidgetRegistration>;
}

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
	installPlatformMock();
	const params: URLSearchParams = new URLSearchParams(window.location.search);
	const scenarioId: string | null = params.get('scenario');
	const scenario: PreviewScenario | undefined = previewScenarios.find(
		(candidate: PreviewScenario): boolean => candidate.id === scenarioId
	);
	const fixture: PreviewFixture = scenario?.fixture ?? previewFixture;

	await import('../src/index');

	const previewWindow: PreviewWindow = window;
	const applicationName: string = `${configJson.name}_${configJson.version}`;
	const registration: WidgetRegistration | undefined = previewWindow.CustomWidget?.[applicationName];

	if (!registration) {
		throw new Error(`Custom widget registration '${applicationName}' was not created.`);
	}

	const eventSubject: Subject<unknown> = new Subject<unknown>();
	const config: Record<string, unknown> = {
		...fixture.additionalConfig,
		id: fixture.id,
		configValues: fixture.configValues,
		dataPickerValues: fixture.dataPickerValues,
		datasourceIds: fixture.datasourceIds
	};

	await registration.create('#wallboard-preview-root', config, eventSubject);
	markReady();
};

void mountWidget().catch((error: unknown): void => {
	showFailure(error);
	throw error;
});
