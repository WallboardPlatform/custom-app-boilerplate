import { createContext, createEffect, onCleanup, createSignal, onMount } from 'solid-js';
import type { ParentComponent, Accessor, JSX, Context, ParentProps } from 'solid-js';

import { getMetadata } from '@hooks/system/getMetadata';

import { useApiMethods, InterceptorService, MetadataProvider, INTERCEPTOR_ATTRIBUTE, createLogger } from 'wallboard-app-sdk';
import type { IApiService, ILoggerService } from 'wallboard-app-sdk';

export interface InterceptorContextInterface {
	/** Current enabled state of the interceptor */
	enabled: Accessor<boolean>;

	/** Enable or disable the interceptor */
	setEnabled: (enabled: boolean) => void;

	/** Clear the URL resolution cache */
	clearCache: () => void;

	/** Get the current cache size */
	getCacheSize: () => number;

	/** Check if the interceptor is ready and initialized */
	isReady: Accessor<boolean>;

	/** Force reprocess all elements in the container */
	reprocessAll: () => void;
}

export interface InterceptorProviderProps {
	/**
	 * Container element for the interceptor (scope)
	 * Can be passed as a ref or will use document.body as fallback
	 */
	container?: HTMLElement;

	/**
	 * Initial enabled state
	 * @default true (in displayer mode)
	 */
	initialEnabled?: boolean;

	/**
	 * Optional custom intercept handler
	 * If not provided, uses default API.cacheFile behavior
	 */
	onIntercept?: (url: string, element: HTMLElement) => Promise<string> | string;
}

export const InterceptorContext: Context<InterceptorContextInterface | undefined> = createContext<InterceptorContextInterface>();

/**
 * Custom Application level interceptor broker that pauses element renders until URLs are cached via the SDK and the Displayer.
 * Acts as a coordination layer between displayer, SDK, and app - the actual caching is delegated to SDK methods (API.cacheFile) or custom intercept handlers.
 *
 * Only runs in displayer environment.
 */
export const InterceptorProvider: ParentComponent<InterceptorProviderProps> = (
	props: ParentProps<InterceptorProviderProps>
): JSX.Element => {
	/* SDK */
	const metadata: MetadataProvider = getMetadata();
	const logger: ILoggerService = createLogger(metadata, 'InterceptorProvider');
	const API: IApiService = useApiMethods(metadata);

	/* Signals & State */
	const [enabled, setEnabled] = createSignal<boolean>(false);
	const [isReady, setIsReady] = createSignal<boolean>(false);
	const [isDisplayer, setIsDisplayer] = createSignal<boolean>(false);

	let interceptor: InterceptorService | null = null;
	let containerRef: HTMLElement | null = null;

	/**
	 * Check if running in displayer environment
	 */
	const checkDisplayerEnvironment: () => boolean = (): boolean => {
		const displayerCheck: boolean = API.isDisplayer();
		setIsDisplayer(displayerCheck);

		if (!displayerCheck) {
			logger.warn('Interceptor is only available in Displayer mode. Running in no-op mode.');
		}

		return displayerCheck;
	};

	/**
	 * Generate unique container ID for tracking
	 */
	const ensureContainerIdentifier: (container: HTMLElement) => void = (container: HTMLElement): void => {
		if (!container.getAttribute(INTERCEPTOR_ATTRIBUTE.Identifier)) {
			const uniqueId: string = API.createUUID(true);
			container.setAttribute(INTERCEPTOR_ATTRIBUTE.Identifier, uniqueId);

			logger.debug(`Container identified with ID: ${uniqueId}`);
		}
	};

	/**
	 * Default intercept handler using API.cacheFile
	 */
	const defaultInterceptHandler: (url: string) => Promise<string> = async (url: string): Promise<string> => {
		try {
			if (API && typeof API.cacheFile === 'function') {
				return await API.cacheFile(url);
			}

			// Fallback to original URL if SDK's ApiService is not available
			logger.warn('API.cacheFile not available, returning original URL');

			return url;
		} catch (error) {
			logger.error('Failed to cache URL:', error);

			// Return original URL on error to prevent breaking the app
			return url;
		}
	};

	/**
	 * Initialize the interceptor service
	 */
	const initializeInterceptor: () => void = (): void => {
		if (!checkDisplayerEnvironment()) {
			setIsReady(false);

			return;
		}

		// Resolve container
		containerRef = props.container ?? document.body;

		if (!containerRef) {
			const error = new Error('Container element is not available');
			logger.error(error.message);

			return;
		}

		ensureContainerIdentifier(containerRef);

		// Create interceptor instance
		try {
			interceptor = new InterceptorService(metadata, {
				container: containerRef,
				onIntercept: props.onIntercept ?? defaultInterceptHandler,
				enabled: props.initialEnabled ?? true
			});

			// Set initial enabled state
			setEnabled(props.initialEnabled ?? true);
			setIsReady(true);

			logger.info('Interceptor service initialized successfully!');
		} catch (error) {
			const err: Error = error instanceof Error ? error : new Error(String(error));
			logger.error('Failed to create interceptor instance:', err);
			setIsReady(false);
		}
	};

	/**
	 * Cleanup interceptor resources
	 */
	const cleanupInterceptor: () => void = (): void => {
		if (interceptor) {
			try {
				interceptor.destroy();

				logger.info('Interceptor destroyed!');
			} catch (error) {
				logger.error('Error during interceptor cleanup:', error);
			} finally {
				interceptor = null;
				containerRef = null;
				setIsReady(false);
			}
		}
	};

	// Initialize on mount
	onMount((): void => {
		initializeInterceptor();
	});

	// Sync enabled state with interceptor
	createEffect((): void => {
		if (interceptor && isReady()) {
			interceptor.setEnabled(enabled());

			logger.debug(`Interceptor ${enabled() ? 'enabled' : 'disabled'}!`);
		}
	});

	// Cleanup on unmount
	onCleanup((): void => {
		cleanupInterceptor();
	});

	/**
	 * Context value with all public methods
	 */
	const contextValue: InterceptorContextInterface = {
		enabled,

		setEnabled: (value: boolean): void => {
			if (isDisplayer()) {
				setEnabled(value);
			} else {
				logger.warn('Cannot change enabled state: not in displayer mode!');
			}
		},

		clearCache: (): void => {
			if (!isDisplayer()) {
				logger.warn('Cannot clear cache: not in displayer mode!');

				return;
			}

			if (interceptor) {
				interceptor.clearCache();

				logger.debug('Cache cleared!');
			}
		},

		getCacheSize: (): number => {
			if (isDisplayer() && interceptor) {
				return interceptor.getCacheSize();
			}

			return 0;
		},

		isReady,

		reprocessAll: (): void => {
			if (!isDisplayer()) {
				logger.warn('Cannot reprocess: not in displayer mode!');

				return;
			}

			if (interceptor && isReady()) {
				// Temporarily disable and re-enable to force reprocessing
				const wasEnabled: boolean = enabled();
				interceptor.setEnabled(false);
				interceptor.clearCache();

				if (wasEnabled) {
					interceptor.setEnabled(true);
				}

				logger.debug('Forced reprocess of all elements!');
			}
		}
	};

	return (
		<InterceptorContext.Provider value={contextValue}>
			{props.children}
		</InterceptorContext.Provider>
	);
};