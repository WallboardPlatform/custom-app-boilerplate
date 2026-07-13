import { from } from 'solid-js';
import type { Accessor } from 'solid-js';

import { getApplicationState } from '@hooks/system/getApplicationState';

import type { ApplicationState } from 'wallboard-app-sdk';
import type { Settings } from '@interfaces/application.interface';

/**
 * Hook to access the application settings.
 *
 * Returns a reactive accessor that provides access to the application's settings object.
 * Settings contain the mapped configuration values from the raw config object.
 *
 * @returns {Accessor<Settings>} A SolidJS accessor that returns the application
 * settings object. The accessor is reactive and will automatically update when
 * settings are modified.
 *
 * @throws {Error} Throws an error if called outside an ApplicationProvider.
 * This hook must be used within a component tree that is wrapped by the ApplicationProvider.
 *
 * @example
 * ```tsx
 * function ThemeSelector() {
 *   const settings = useSettings();
 *
 *   return (
 *     <div class={settings().theme}>
 *       <p>Current theme: {settings().theme}</p>
 *       <p>Language: {settings().language}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSettings<T = Settings>(): Accessor<T> {
	const state: ApplicationState = getApplicationState();

	const settings: Accessor<Record<string, unknown> | undefined> = from(state.settings$);

	if (!settings()) {
		throw new Error('No settings available!');
	}

	return settings as Accessor<T>;
}