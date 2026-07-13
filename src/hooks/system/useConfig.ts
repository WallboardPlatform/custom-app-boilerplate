import { from } from 'solid-js';
import type { Accessor } from 'solid-js';

import { getApplicationState } from '@hooks/system/getApplicationState';

import type { ApplicationState } from 'wallboard-app-sdk';
import type { Config } from '@interfaces/application.interface';

/**
 * Hook to access the application's configuration data.
 *
 * Returns a reactive accessor that provides access to the complete application configuration object.
 * The configuration contains all settings, parameters, and data needed throughout the application lifecycle.
 *
 * @returns {Accessor<Config>} A SolidJS accessor that returns the complete application configuration object.
 * The accessor is reactive and will automatically update when the configuration changes.
 *
 * @throws {Error} Throws an error if called outside an ApplicationProvider.
 * This hook must be used within a component tree that is wrapped by the ApplicationProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const config = useConfig();
 *
 *   return (
 *     <div>
 *       <p>{config()}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useConfig<T = Config>(): Accessor<T> {
	const state: ApplicationState = getApplicationState();

	const config: Accessor<unknown> = from(state.config$);

	if (!config()) {
		throw new Error('No configuration available!');
	}

	return config as Accessor<T>;
}