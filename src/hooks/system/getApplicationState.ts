import { useContext } from 'solid-js';

import type { ApplicationState } from 'wallboard-app-sdk';
import { ApplicationContext } from '@contexts/system/application.context';

/**
 * Hook to access the application state.
 *
 * Retrieves the ApplicationState instance from the ApplicationContext, providing
 * access to the core application state management including settings, configuration,
 * and other reactive application data.
 *
 * @returns {ApplicationState} The ApplicationState instance containing all application
 * state management functionality, including reactive accessors for settings, config,
 * and other application-wide state.
 *
 * @throws {Error} Throws an error with message "Application state not available!" if called outside an ApplicationProvider.
 * This hook must be used within a component tree that is wrapped by the ApplicationProvider.
 */
export function getApplicationState(): ApplicationState {
	const state: ApplicationState | undefined = useContext(ApplicationContext);

	if (!state) {
		throw new Error('Application state not available!');
	}

	return state;
}