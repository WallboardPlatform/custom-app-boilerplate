/* @refresh reload */
import 'reflect-metadata';

import { ErrorBoundary, Show } from 'solid-js';
import type { JSX } from 'solid-js';

import { render } from 'solid-js/web';
import type { MountableElement } from 'solid-js/web';

/* Context Providers */
import { ApplicationProvider } from '@contexts/system/application.context';
import { DIProvider } from '@contexts/system/dependency-injection.context';
import { InterceptorProvider } from '@contexts/system/interceptor.context';

/* Root Styles */
import 'wallboard-app-sdk/wallboard-app-sdk.css';
import './index.css';

/* Main Component */
import WbApp from '@components/wb-app/wb-app';

/* SDK */
import { Application, MetadataProvider, WbErrorBoundary, WbModal } from 'wallboard-app-sdk';
import type { ApplicationContainer } from 'wallboard-app-sdk';

/* Application Services and Settings */
import serviceClasses from './services';
import mapSettings from './settings';

/* Configuration File */
import * as configJson from './editor-assets/properties.json';

/**
 * Validate configuration object
 */
function validateConfig(config: unknown): void {
	const requiredProps: Record<string, string> = {
		name: 'string',
		version: 'string'
	};

	// Validate configuration object exists
	if (!config || typeof config !== 'object') {
		throw new Error('Configuration file is missing or invalid!');
	}

	// Validate each required property
	const missingProps: string[] = [];
	const invalidProps: string[] = [];

	Object.entries(requiredProps).forEach(([prop, expectedType]: [string, string]): void => {
		const value: unknown = (config as Record<string, unknown>)[prop];

		if (!(prop in config) || !value) {
			missingProps.push(prop);
		} else if (typeof value !== expectedType) {
			invalidProps.push(prop);
		}
	});

	// Throw appropriate errors
	if (missingProps.length > 0) {
		throw new Error(`Missing required configuration properties: ${missingProps.join(', ')}`);
	}

	if (invalidProps.length > 0) {
		throw new Error(`Invalid configuration property types: ${invalidProps.join(', ')}`);
	}
}

/**
 * Render function for application
 */
function application(
	element: MountableElement,
	container: ApplicationContainer
): void {
	const metadataProvider: MetadataProvider = container.container.resolve('metadata');

	render(
		(): JSX.Element => {
			let applicationContainerRef: HTMLDivElement | undefined;

			return (
				<Show when={container.state[0]()}>
					<ErrorBoundary
						fallback={(err: Error, reset: () => void): JSX.Element => (
							<WbErrorBoundary
								error={err}
								metadataProvider={metadataProvider}
								reloadComponent={reset}
							/>
						)}
					>
						<ApplicationProvider state={container.appState}>
							<DIProvider dependencies={container.container}>
								<div
									ref={(div: HTMLDivElement): HTMLDivElement => applicationContainerRef = div}
									class="wallboard-application"
									data-application-name={configJson.name || 'Unknown'}
									data-application-version={configJson.version || 'Unknown'}
								>
									<InterceptorProvider
										container={applicationContainerRef}
									>
										<WbModal metadataProvider={metadataProvider} />
										<WbApp hostElement={applicationContainerRef!} />
									</InterceptorProvider>
								</div>
							</DIProvider>
						</ApplicationProvider>
					</ErrorBoundary>
				</Show>
			);
		},
		element
	);
}

/**
 * Initialize the application
 */
((): void => {
	try {
    // Add 'ca' class to HTML element for CSS inheritance
    document.documentElement.classList.add('ca');

		// Validate application configuration
		validateConfig(configJson);

		// Register the Application
		new Application({
			name: configJson.name,
			version: configJson.version,
			mode: import.meta.env.MODE,
			services: serviceClasses,
			render: application,
			settingsMapper: mapSettings as (config: unknown) => Record<string, unknown>
		});
	} catch (error) {
		// eslint-disable-next-line no-console
		console.error('Failed to initialize application:', error);

		throw error;
	}
})();