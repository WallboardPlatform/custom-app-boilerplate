/**
 * Wallboard App Zipper Plugin
 * Entry point for the Vite plugin
 */

import { WBAppZipperPlugin } from './core';
import { PluginConfig } from './types';
import { PluginOption } from 'vite';

/**
 * Creates and returns a Vite plugin for Wallboard zip packaging
 *
 * @param config - Configuration object containing zip settings
 * @returns Vite plugin object
 */
export default function WBAppZipper(config: PluginConfig): PluginOption {
	const plugin = new WBAppZipperPlugin(config);
	return plugin.getPlugin();
}

// Re-export types for consumers
export * from './types';
export * from './config';