/**
 * Configuration types for the plugin
 */
export interface WBPluginMetadata {
	buildMode: string;

	// Build progress fields
	isBuilding?: boolean;
	progress?: number;
	step?: string;
	startTime?: number;
}

export interface BuildEnvironment {
	isProduction: boolean;
	isDevelopment: boolean;
	mode: 'production' | 'development';
}

export interface VitePluginHooks {
	name: string;
	closeBundle(): Promise<void>;
}
