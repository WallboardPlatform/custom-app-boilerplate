/**
 * Configuration types for the plugin
 */
export interface WBPluginMetadata {
	widgetId?: string;
	minioBucket?: string;
	minioHost?: string;
	buildMode: string;

	// Build progress fields
	isBuilding?: boolean;
	progress?: number;
	step?: string;
	startTime?: number;
}

export interface PluginConfig {
	id?: string;
	minio?: MinioConfig;
	zipOutput?: string;
}

export interface MinioConfig {
	host: string;
	port: number;
	useSSL: boolean;
	accessKey: string;
	secretKey: string;
	bucket: string;
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