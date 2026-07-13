import { from } from 'solid-js';
import type { Accessor } from 'solid-js';

import { getApplicationState } from '@hooks/system/getApplicationState';

import type { ApplicationState, DataSourceState } from 'wallboard-app-sdk';

/**
 * Hook to access the available data sources in the application.
 *
 * Returns a reactive accessor that provides access to all registered data sources in the wallboard application.
 * Data sources are used to fetch and provide data for widgets, cards, and other components that require external or dynamic data.
 *
 * @returns {Accessor<DataSources>} A SolidJS accessor that returns the collection of available data sources.
 * The accessor is reactive and will automatically update when data sources are added, removed, or modified.
 *
 * @throws {Error} Throws an error if called outside an ApplicationProvider.
 * This hook must be used within a component tree that is wrapped by the ApplicationProvider.
 *
 * @example
 * ```tsx
 * function DataSourceSelector() {
 *   const dataSources = useDataSources();
 *
 *   return (
 *     <select>
 *       <For each={Object.keys(dataSources())}>
 *         {(key) => <option value={key}>{dataSources()[key].id}</option>}
 *       </For>
 *     </select>
 *   );
 * }
 * ```
 */
export function useDataSources(): Accessor<Record<string, DataSourceState>> {
	const state: ApplicationState = getApplicationState();

	const dataSources: Accessor<Record<string, DataSourceState> | undefined> = from(state.dataSources$);

	if (!dataSources()) {
		throw new Error('No data source available!');
	}

	return dataSources as Accessor<Record<string, DataSourceState>>;
}