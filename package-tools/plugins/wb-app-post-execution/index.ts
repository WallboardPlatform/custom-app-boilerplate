/**
 * Wallboard App Post Execution Plugin
 * Entry point for the Vite plugin
 */

import { WBAppPostExecutionPlugin } from './core';
import { PluginOption } from 'vite';

/**
 * Creates and returns a Vite plugin for Wallboard post-execution tasks
 *
 * @param isProduction - Whether this is a production build
 * @returns Vite plugin object
 */
export default function WBAppPostExecution(
	isProduction: boolean
): PluginOption {
	const plugin = new WBAppPostExecutionPlugin(isProduction);
	return plugin.getPlugin();
}

export * from './types';
