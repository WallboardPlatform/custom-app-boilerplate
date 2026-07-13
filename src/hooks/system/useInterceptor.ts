import { useContext } from 'solid-js';

import { InterceptorContext } from '@contexts/system/interceptor.context';
import type { InterceptorContextInterface } from '@contexts/system/interceptor.context';

/**
 * Hook to access the interceptor context for managing URL and image interception.
 *
 * This hook provides access to the InterceptorService functionality through SolidJS context, allowing components to control caching behavior, enable/disable interception, and monitor cache state within a scoped container.
 *
 * @returns {InterceptorContextInterface} The interceptor context interface containing:
 *   - `enabled`: Accessor for the current enabled state of the interceptor
 *   - `setEnabled`: Function to enable or disable URL/image interception
 *   - `clearCache`: Function to clear all cached URLs/images
 *   - `getCacheSize`: Function to get the current number of cached items
 *
 * @throws {Error} Throws an error if called outside the InterceptorProvider.
 *   The hook must be used within a component tree that has InterceptorProvider
 *   as an ancestor to ensure the context is available.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { enabled, setEnabled, clearCache, getCacheSize } = useInterceptor();
 *
 *   return (
 *     <div>
 *       <p>Interceptor is {enabled() ? 'enabled' : 'disabled'}</p>
 *       <p>Cache size: {getCacheSize()}</p>
 *       <button onClick={() => setEnabled(!enabled())}>
 *         Toggle Interceptor
 *       </button>
 *       <button onClick={clearCache}>Clear Cache</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @see {@link InterceptorProvider} for setting up the interceptor context
 * @see {@link InterceptorContextInterface} for the complete context interface
 */
export const useInterceptor: () => InterceptorContextInterface = (): InterceptorContextInterface => {
	const context: InterceptorContextInterface | undefined = useContext(InterceptorContext);

	if (!context) {
		throw new Error('useInterceptor must be used within InterceptorProvider!');
	}

	return context;
};