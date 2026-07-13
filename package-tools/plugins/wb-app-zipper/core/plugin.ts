/**
 * Wallboard App Zipper Plugin
 * Main plugin class that orchestrates zip creation
 */
import * as path from 'path';
import { BaseZipperPlugin } from './abstract';
import { ProgressLogger } from '../../../logger';
import { MetadataFormatter } from '../../../logger/formatters';
import { FileSystemService } from '../../../filesystem';
import { ZipperService } from '../services';
import { PluginConfig, AssetsConfig, ZipperMetadata, ZipResult } from '../types';
import { ZipperPathConfig } from '../config';

/**
 * Custom progress logger for zipper operations
 */
class ZipperProgressLogger extends ProgressLogger<ZipperMetadata> {
	protected override displayMetadata(): void {
		const metadata = this.getMetadata();

		// Prepare display metadata
		const displayData: Record<string, unknown> = {
			assetName: metadata.assetName,
			assetVersion: metadata.assetVersion,
			sourceDirectory: metadata.sourceDirectory,
			outputDirectory: metadata.outputDirectory,
			fileName: metadata.fileName
		};

		// Display configuration using MetadataFormatter
		MetadataFormatter.displayMetadata('ℹ️  Configuration:', displayData, {
			showIcons: true,
			filterEmpty: true,
			indent: '   '
		});
		this.newline();

		// Display compression progress if compressing
		if (metadata.isCompressing && metadata.compressionProgress !== undefined) {
			this.displayCompressionProgress(metadata);
		}
	}

	private displayCompressionProgress(metadata: ZipperMetadata): void {
		console.log('🗜️  COMPRESSION PROGRESS');
		this.divider();

		// Show progress bar
		const bar = this.createProgressBar(metadata.compressionProgress || 0);
		console.log(bar);

		// Show file count
		if (metadata.totalFiles && metadata.totalFiles > 0) {
			console.log(`Files: ${metadata.filesProcessed || 0}/${metadata.totalFiles}`);
		}

		// Show elapsed time
		if (metadata.startTime && metadata.startTime > 0) {
			const elapsed = (Date.now() - metadata.startTime) / 1000;
			console.log(`Time Elapsed: ${elapsed.toFixed(1)}s`);
		}

		this.newline();
	}

	private createProgressBar(percentage: number): string {
		const width = 40;
		const filled: number = Math.round((width * percentage) / 100);
		const empty: number = Math.max(0, width - filled);
		return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
	}
}

export class WBAppZipperPlugin extends BaseZipperPlugin {
	private config: PluginConfig;
	private assetsConfig?: AssetsConfig;
	private progressLogger: ZipperProgressLogger;
	private fileName: string = '';
	private outputPath: string = '';

	constructor(config: PluginConfig) {
		super();
		this.config = config;

		// Initialize progress logger with placeholder data
		this.progressLogger = new ZipperProgressLogger(
			{
				assetName: '',
				assetVersion: '',
				sourceDirectory: ZipperPathConfig.DIST_PATH,
				outputDirectory: '',
				fileName: ''
			},
			{
				headerTitle: 'WALLBOARD ZIPPER',
				headerIcon: '📦',
				useSimpleOutput: process.env.SIMPLE_OUTPUT === 'true'
			}
		);
	}

	/**
	 * Get plugin name
	 */
	protected getPluginName(): string {
		return 'wb-app-zipper';
	}

	/**
	 * Execute all zipper tasks
	 */
	protected async executeTasks(): Promise<void> {
		try {
			if (process.env.DO_APPLICATION_ZIP === undefined || process.env.DO_APPLICATION_ZIP === 'false') {
				return;
			}

			// Wait for Chrome 49 build to be ready
			await this.waitForChrome49Build();

			// Step 1: Load configuration
			this.progressLogger.setStep(1, 4, 'Loading configuration');
			await this.loadConfig();

			// Step 2: Determine output path
			this.progressLogger.setStep(2, 4, 'Determining output path');
			this.determineOutputPath();

			// Step 3: Create zip archive
			this.progressLogger.setStep(3, 4, 'Creating zip archive');
			const result: ZipResult = await this.createZipArchive();

			// Step 4: Show completion
			this.showSuccess(result);
		} catch (error) {
			this.showFailure(error);
			throw error;
		}
	}

	/**
	 * Wait for Chrome 49 build to complete
	 */
	private async waitForChrome49Build(): Promise<void> {
		const chrome49File: string = path.join(ZipperPathConfig.DIST_PATH, 'assets', 'app-chrome-49.js');
		const maxAttempts = 30; // Wait up to 30 seconds

		this.logger.info('Waiting for Chrome 49 build to complete...');

		for (let i: number = 0; i < maxAttempts; i++) {
			if (FileSystemService.exists(chrome49File)) {
				this.logger.success('Chrome 49 build detected, starting zip creation...');

				await this.delay(500);

				return;
			}
			await this.delay(1000);
		}

		throw new Error('Chrome 49 build file not found after waiting 30 seconds. Expected: ' + chrome49File);
	}

	/**
	 * Load and validate configuration files
	 */
	/**
	 * Load and validate configuration files
	 */
	private async loadConfig(): Promise<void> {
		try {
			// Use config values first, fall back to properties.json, then defaults
			const assetName: string = this.config.name
				|| this.assetsConfig?.name
				|| `Unknown-Application-${Date.now()}`;

			const assetVersion: string = this.config.version
				|| this.assetsConfig?.version
				|| 'NaN';

			// Create final config object
			this.assetsConfig = {
				name: assetName,
				version: assetVersion
			};

			// Create sanitized filename
			this.fileName = this.createSanitizedFileName();

			// Update progress logger with loaded config
			this.progressLogger.updateMetadata({
				assetName: this.assetsConfig.name,
				assetVersion: this.assetsConfig.version,
				fileName: this.fileName
			});

			this.logger.success('Configuration loaded successfully');
		} catch (error) {
			const message: string = error instanceof Error ? error.message : String(error);
			this.logger.error(`Failed to load configuration: ${message}`);
			throw error;
		}
	}

	/**
	 * Create sanitized filename from asset configuration
	 */
	private createSanitizedFileName(): string {
		if (!this.assetsConfig) {
			throw new Error('Assets configuration not loaded');
		}

		const sanitizedName: string = this.assetsConfig.name.replace(/[^\w.-]/g, '_');
		return `${sanitizedName}_${this.assetsConfig.version}.zip`;
	}

	/**
	 * Determine the appropriate output path
	 */
	private determineOutputPath(): void {
		if (!this.fileName) {
			throw new Error('Filename not generated');
		}

		// Check if output path is configured and valid
		const configuredPath: string | undefined = this.config.zipOutput;

		if (configuredPath && FileSystemService.exists(configuredPath)) {
			this.outputPath = path.join(configuredPath, this.fileName);
			this.logger.info(`Using configured output path: ${this.outputPath}`);
		} else {
			// Use Desktop as fallback
			const desktopPath: string = ZipperPathConfig.getDefaultOutputPath();
			FileSystemService.ensureDirectory(desktopPath);
			this.outputPath = path.join(desktopPath, this.fileName);
			this.logger.info(`Using fallback Desktop path: ${this.outputPath}`);
		}

		// Update progress logger
		this.progressLogger.updateMetadata({
			outputDirectory: path.dirname(this.outputPath)
		});
	}

	/**
	 * Create zip archive
	 */
	private async createZipArchive(): Promise<ZipResult> {
		const zipperService = new ZipperService({
			sourcePath: ZipperPathConfig.DIST_PATH,
			outputPath: this.outputPath,
			fileName: this.fileName,
			compressionOptions: {
				level: 9 // Maximum compression
			},
			logger: this.logger,
			progressLogger: this.progressLogger
		});

		return await zipperService.execute();
	}

	/**
	 * Show success message
	 */
	private showSuccess(result: ZipResult): void {
		const sizeInMB: string = (result.size / (1024 * 1024)).toFixed(2);
		const message = `Successfully created ${path.basename(result.path)}`;
		const details = `📁 Output: ${result.path}\n📊 Size: ${sizeInMB} MB`;

		this.progressLogger.showCompletion(true, message, details);
	}

	/**
	 * Show failure message
	 */
	private showFailure(error: unknown): void {
		const message: string = error instanceof Error ? error.message : String(error);
		this.progressLogger.showCompletion(false, `Compression failed: ${message}`);
	}
}