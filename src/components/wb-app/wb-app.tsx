import { createEffect, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { getMetadata } from '@hooks/system/getMetadata';
import { useConfig } from '@hooks/system/useConfig';
import { useSettings } from '@hooks/system/useSettings';
import { useDataSources } from '@hooks/system/useDataSources';
import { useExternalCommandListener } from '@hooks/system/useExternalCommandListener';

import { MetadataProvider, createLogger, createModal, useApiMethods, useWeather } from 'wallboard-app-sdk';
import type { IApiService, IExternalCommandService, ILoggerService, IModalInstance } from 'wallboard-app-sdk';

import WbLayoutBuilder from '@components/wb-layout-builder/wb-layout-builder';
import { sanitize } from '@utils/sanitize';

import type { Config, DataSources, Settings } from '@interfaces/application.interface';

import style from '@components/wb-app/wb-app.module.scss';

export default (props: {
	hostElement: HTMLDivElement;
}): JSX.Element => {
	/* Hooks */
	const metadata: MetadataProvider = getMetadata();
	const logger: ILoggerService = createLogger(metadata, 'WbApp');
	const config: Accessor<Config> = useConfig();
	const settings: Accessor<Settings> = useSettings();
	const dataSources: Accessor<DataSources> = useDataSources();
	const API: IApiService = useApiMethods(metadata);
	const weatherApi = useWeather(metadata);

	onMount((): void => {
		logger.info('Host Element', props.hostElement);

		API.triggerSensorEvent('test-event', 'Hello Boilerplate!');
	});

	createEffect((): void => {
		logger.info('Raw Config', config());
	});

	createEffect((): void => {
		logger.info('Settings', settings());
	});

	createEffect((): void => {
		logger.info('DataSources', dataSources());
	});

	createEffect((): void => {
		void weatherApi.getCity('75001', 'US', {}).then((data: unknown): void => {
			logger.info('Weather Data', data);
		});
	});

	useExternalCommandListener((command: IExternalCommandService): void => {
		logger.info('External Command', command.getEventData());
	});

	/*
	 * Modal Example
	 * -
	 * Creates an SDK modal with a simple message and close button.
	 * The WbModal component in index.tsx renders the modal overlay.
	 */
	const testModal: IModalInstance = createModal(metadata, {
		title: 'Test Modal',
		children: <p>This is the SDK modal popup, triggered from the boilerplate widget.</p>,
		buttons: [
			{
				label: 'Close',
				variant: 'cancel',
				onClick: (): void => testModal.close()
			}
		]
	});

	onCleanup((): void => {
		testModal.close();
	});

	/*
	 * Sanitization Example
	 * -
	 * Use sanitize() to safely render user-provided HTML content.
	 * DOMPurify strips malicious content (scripts, event handlers)
	 * while preserving safe markup.
	 */
	const sanitizedHtml: string = sanitize(
			'<b>Hello</b> <i>Boilerplate</i>! <script>console.log("This text should not appear in your console")</script>',
			'html'
	);

	return (
		<>
			<div class={`wb-app ${style['wb-app']}`}>
				<Show
					when={settings().layoutEditor && settings().layoutEditor?.length !== 0}
					fallback={
						<>
							<h1>Hello Boilerplate!</h1>
							<button onClick={(): void => testModal.open()}>Open Modal</button>
							<div innerHTML={sanitizedHtml} />
						</>
					}
				>
					<WbLayoutBuilder layout={settings().layoutEditor!} />
				</Show>
			</div>
		</>
	);
};
