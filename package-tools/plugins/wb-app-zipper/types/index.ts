/**
 * Type definitions for Zipper plugin
 */
export interface PluginConfig {
	zipOutput?: string;
	name?: string;
	version?: string;
}

export interface AssetsConfig {
	name: string;
	version: string;
}

export interface ZipperMetadata {
	assetName: string;
	assetVersion: string;
	sourceDirectory: string;
	outputDirectory: string;
	fileName: string;
	// Progress tracking
	isCompressing?: boolean;
	compressionProgress?: number;
	filesProcessed?: number;
	totalFiles?: number;
	startTime?: number;
}

export interface ZipResult {
	path: string;
	size: number;
	success: boolean;
	error?: string;
}

export interface CompressionOptions {
	level?: number; // 0-9, compression level
	method?: 'deflate' | 'store';
	excludePatterns?: string[];
	includePatterns?: string[];
}

export interface VitePluginHooks {
	name: string;
	closeBundle(): Promise<void>;
}

export interface BuildEnvironment {
	isProduction: boolean;
	isDevelopment: boolean;
	mode: 'production' | 'development';
}