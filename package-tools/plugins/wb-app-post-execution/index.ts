/**
 * Wallboard App Post Execution Plugin
 * Entry point for the Vite plugin
 */

import { WBAppPostExecutionPlugin } from './core';
import { PluginConfig, VitePluginHooks } from './types';
import { PluginOption } from 'vite';

/**
 * Creates and returns a Vite plugin for Wallboard post-execution tasks
 *
 * @param config - Configuration object containing widget ID, MinIO settings, etc.
 * @param isProduction - Whether this is a production build
 * @returns Vite plugin object
 */
export default function WBAppPostExecution(
	config: PluginConfig,
	isProduction: boolean
): PluginOption {
	const plugin = new WBAppPostExecutionPlugin(config, isProduction);
	return plugin.getPlugin();
}

export * from './types';