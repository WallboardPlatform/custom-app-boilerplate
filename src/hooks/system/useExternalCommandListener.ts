import { onCleanup } from 'solid-js';

import type { ApplicationState, IExternalCommandService } from 'wallboard-app-sdk';
import { getApplicationState } from '@hooks/system/getApplicationState';

/**
 * Hook to listen for external commands with automatic cleanup.
 *
 * @param callback Function to execute when an external command is received
 *
 * @example
 * ```tsx
 * useExternalCommandListener((command) => {
 *   console.log('External command received:', command.getCommand());
 * });
 * ```
 */
export function useExternalCommandListener(callback: (command: IExternalCommandService) => void): () => void {
	const state: ApplicationState = getApplicationState();
	
	const dispose: () => void = state.createExternalCommandListener(callback);
	
	// Auto cleanup on destroy
	onCleanup((): void => {
		dispose();
	});
	
	return dispose;
}