import { createContext, onCleanup, onMount } from 'solid-js';
import type { Context, JSX } from 'solid-js';
import type { DependencyContainer } from 'tsyringe';

import serviceClasses, { Constructor } from '../../services';

export const DIContextProvider: Context<DependencyContainer | undefined> = createContext<DependencyContainer>();

export function DIProvider(props: { dependencies: DependencyContainer; children: JSX.Element }): JSX.Element {
	return (
		<>
			{/* eslint-disable-next-line solid/reactivity */}
			<DIContextProvider.Provider value={props.dependencies}>
				<ServiceLifecycleManager dependencies={props.dependencies}>{props.children}</ServiceLifecycleManager>
			</DIContextProvider.Provider>
		</>
	);
}

/**
 * Inner component that manages service lifecycle hooks (onConstruct/onDestruct).
 * Must be rendered INSIDE the DIContextProvider.Provider so that services
 * can access the DI context via useContext() during construction.
 */
function ServiceLifecycleManager(props: { dependencies: DependencyContainer; children: JSX.Element }): JSX.Element {
	onMount((): void => {
		// Call onConstruct on all services now that DI context is available
		serviceClasses.forEach((ServiceClass: Constructor): void => {
			try {
				const serviceInstance = props.dependencies.resolve(ServiceClass);

				if (
					serviceInstance &&
					typeof serviceInstance.onConstruct === 'function' &&
					hasOwnMethod(serviceInstance, 'onConstruct')
				) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call
					serviceInstance.onConstruct();
				}
			} catch (error) {
				// eslint-disable-next-line no-console
				console.warn(error);
			}
		});
	});

	onCleanup((): void => {
		// Call onDestruct on all services now that DI context is available
		serviceClasses.forEach((ServiceClass: Constructor): void => {
			try {
				const serviceInstance = props.dependencies.resolve(ServiceClass);

				if (
					serviceInstance &&
					typeof serviceInstance.onDestruct === 'function' &&
					hasOwnMethod(serviceInstance, 'onDestruct')
				) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-call
					serviceInstance.onDestruct();
				}
			} catch (error) {
				// eslint-disable-next-line no-console
				console.warn(error);
			}
		});
	});

	const hasOwnMethod = (instance: Constructor, methodName: string): boolean => {
		const proto = Object.getPrototypeOf(instance);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return proto && Object.prototype.hasOwnProperty.call(proto, methodName);
	};

	return <>{props.children}</>;
}
