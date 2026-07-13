import { useContext } from 'solid-js';
import type { DependencyContainer } from 'tsyringe';

import { DIContextProvider } from '@contexts/system/dependency-injection.context';

import { MetadataProvider } from 'wallboard-app-sdk';

/**
 * Hook to access the MetadataProvider instance from the dependency injection container.
 *
 * Returns the MetadataProvider instance that manages metadata for the wallboard application.
 * The MetadataProvider is resolved from the tsyringe DI container and provides access to
 * metadata-related functionality throughout the application.
 *
 * @returns {MetadataProvider} The MetadataProvider instance from the DI container.
 *
 * @throws {Error} Throws an error if called outside a DIContextProvider.
 * This hook must be used within a component tree that is wrapped by the DIContextProvider.
 *
 * @example
 * ```tsx
 * function MetadataDisplay() {
 *   const metadata = getMetadata();
 *
 *   const appInfo = metadata.getMetadata().app;
 *
 *   return (
 *     <div>
 *       <h2>Application Metadata</h2>
 *       <p>Version: {appInfo.version}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function getMetadata(): MetadataProvider {
	const container: DependencyContainer | undefined = useContext(DIContextProvider);

	if (!container) {
		throw new Error(
			'DIContextProvider not found. Make sure your component is wrapped with DIContextProvider.Provider to access application metadata!'
		);
	}

	return container.resolve<MetadataProvider>('metadata');
}
