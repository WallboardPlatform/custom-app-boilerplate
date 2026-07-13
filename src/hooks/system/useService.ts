import { useContext } from 'solid-js';
import type { DependencyContainer } from 'tsyringe';

import { DIContextProvider } from '@contexts/system/dependency-injection.context';

import type { Constructor } from '../../services';

/**
 * Hook to resolve and access service instances from the dependency injection container.
 *
 * Returns a service instance of the specified class type from the tsyringe DI container.
 * This hook provides a convenient way to access singleton services and their functionality
 * within SolidJS components, enabling proper dependency injection patterns in the application.
 *
 * @template T The type of the service to resolve.
 *
 * @param {new (...args: any[]): T} ServiceClass The service class constructor to resolve
 * from the DI container. The class must be registered in the tsyringe container.
 *
 * @returns {T} The resolved service instance of type T.
 *
 * @throws {Error} Throws an error if called outside a DIContextProvider.
 * This hook must be used within a component tree that is wrapped by the DIContextProvider.
 *
 * @note Make sure your services is added to the `services.ts` file before trying to use this hook!
 *
 * @example
 * ```tsx
 * import { TestService } from '@services/test.service';
 *
 * function TestComponent() {
 *   const testService = useService(TestService);
 *
 *   const fetchData = () => {
 *     testService.getData('test').subscribe(data => {
 *       console.log(data);
 *     });
 *   };
 *
 *   return <button onClick={fetchData}>Load Data</button>;
 * }
 * ```
 */
export function useService<T>(ServiceClass: Constructor | string): T {
	const container: DependencyContainer | undefined = useContext(DIContextProvider);

	if (!container) {
		throw new Error(
			'DIContextProvider not found. Make sure your component is wrapped with DIContextProvider.Provider to access services!'
		);
	}

	return container.resolve<T>(ServiceClass);
}
