/**
 * Wallboard App Post Execution Plugin
 * Main plugin class that orchestrates all post-build tasks
 */
import { BasePlugin } from './abstract';
import { ProgressLogger } from '../../../logger';
import { ProgressBarFormatter, MetadataFormatter } from '../../../logger/formatters';
import { AssetsService, Chrome49Service, MinIOService } from '../services';
import { PluginConfig, BuildEnvironment, WBPluginMetadata } from '../types';
import { PathConfig } from '../config';

/**
 * Custom progress logger with build progress display
 */
class WBProgressLogger extends ProgressLogger<WBPluginMetadata> {
	override displayMetadata(): void {
		const metadata: WBPluginMetadata = this.getMetadata();

		// Prepare display metadata (only fields we want to show)
		const displayData: Record<string, unknown> = {};

		if (metadata.widgetId) {
			displayData.widgetId = metadata.widgetId;
		}

		if (metadata.minioBucket) {
			displayData.minioBucket = metadata.minioBucket;
		}

		if (metadata.minioHost) {
			displayData.minioHost = metadata.minioHost;
		}

		displayData.buildMode = metadata.buildMode;

		// Display configuration using MetadataFormatter
		if (Object.keys(displayData).length > 0) {
			MetadataFormatter.displayMetadata('ℹ️  Configuration:', displayData, {
				showIcons: true,
				filterEmpty: true,
				indent: '   '
			});
			this.newline();
		}

		// Display build progress if building
		if (metadata.isBuilding && metadata.progress !== undefined) {
			this.displayBuildProgress(metadata);
		}
	}

	private displayBuildProgress(metadata: WBPluginMetadata): void {
		console.log('🔨 BUILD PROGRESS');
		this.divider();

		const bar: string = ProgressBarFormatter.createBar(
			metadata.progress || 0,
			100,
			{ width: 40 }
		);

		console.log(bar);

		if (metadata.startTime && metadata.startTime > 0) {
			const timeElapsed: number = (Date.now() - metadata.startTime) / 1000;
			console.log(`Build Time: ${timeElapsed.toFixed(1)}s`);
		}

		if (metadata.step) {
			console.log(`🔧 Current: ${metadata.step}`);
		}

		console.log(`🌐 Target: Chrome 49 (Legacy Browser Support)`);
		this.newline();
	}
}

export class WBAppPostExecutionPlugin extends BasePlugin {
	private config: PluginConfig;
	private progressLogger: WBProgressLogger;
	private totalSteps: number = 3;

	constructor(config: PluginConfig, isProduction: boolean) {
		const environment: BuildEnvironment = {
			isProduction,
			isDevelopment: !isProduction,
			mode: isProduction ? 'production' : 'development'
		};

		super({ environment });

		this.config = config;

		// Initialize custom progress logger
		this.progressLogger = new WBProgressLogger(
			{
				widgetId: config.id,
				minioBucket: config.minio?.bucket,
				minioHost: config.minio ? `${config.minio.host}:${config.minio.port}` : undefined,
				buildMode: environment.mode
			},
			{
				headerTitle: 'WALLBOARD POST BUILD EXECUTION',
				headerIcon: '🔧',
				useSimpleOutput: process.env.SIMPLE_OUTPUT === 'true' && this.environment.isProduction
			}
		);

		// Adjust total steps based on configuration
		if ((!config.minio || !config.id) || process.env.DISABLE_MINIO_UPLOAD === 'true') {
			this.totalSteps = 2;
		}
	}

	/**
	 * Get plugin name
	 */
	protected getPluginName(): string {
		return 'wb-app-post-execution';
	}

	/**
	 * Validate configuration
	 */
	protected validate(): void {
		if (process.env.DISABLE_MINIO_UPLOAD === 'true') {
			this.logger.warning(
				'MinIO upload disabled.'
			)
		}

		if (!this.config.id) {
			this.logger.warning(
				'Widget ID not found. Build will proceed but MinIO upload will be skipped.'
			);
		}

		if (!this.config.minio && process.env.DISABLE_MINIO_UPLOAD !== 'true') {
			this.logger.warning(
				'MinIO configuration missing. Build will proceed but upload will be skipped.'
			);
		}
	}

	/**
	 * Execute all post-build tasks
	 */
	protected async executeTasks(): Promise<void> {
		try {
			await this.copyEditorAssets();
			await this.buildChrome49();
			await this.uploadToMinIO();

			this.showSuccess();
		} catch (error) {
			this.showFailure(error);
			throw error;
		}
	}

	/**
	 * Step 1: Copy editor assets
	 */
	private async copyEditorAssets(): Promise<void> {
		this.progressLogger.setStep(1, this.totalSteps, 'Copying editor-assets to dist folder');

		const assetsService: AssetsService = AssetsService.createForEditorAssets({
			logger: this.logger
		});

		assetsService.execute();
		await this.delay(1000); // Small delay to show completion
	}

	/**
	 * Step 2: Build Chrome 49 version
	 */
	private async buildChrome49(): Promise<void> {
		this.progressLogger.setStep(
			2,
			this.totalSteps,
			`Building Chrome 49 version (${this.environment.mode})`
		);

		const chrome49Service = new Chrome49Service({
			isDevelopment: this.environment.isDevelopment,
			logger: this.logger,
			progressLogger: this.progressLogger
		});

		await chrome49Service.execute();
	}

	/**
	 * Step 3: Upload to MinIO (optional)
	 */
	private async uploadToMinIO(): Promise<void> {
		if ((!this.config.minio || !this.config.id) || process.env.DISABLE_MINIO_UPLOAD === 'true') {
			return;
		}

		this.progressLogger.setStep(3, this.totalSteps, 'Uploading files to MinIO');

		const minioService = new MinIOService({
			widgetId: this.config.id,
			minioConfig: this.config.minio,
			uploadFolders: [PathConfig.ASSETS_FOLDER, PathConfig.EDITOR_ASSETS_FOLDER],
			logger: this.logger,
			progressLogger: this.progressLogger
		});

		await minioService.execute();
	}

	/**
	 * Show success message
	 */
	private showSuccess(): void {
		const message: string = 'All build steps completed successfully!';
		let details: string | undefined;

		if (this.config.id && this.config.minio?.bucket) {
			details = `🌐 Files available at: ${this.config.minio.bucket}/apps/widgets/${this.config.id}/`;
		} else {
			details = 'ℹ️  Files upload was skipped (MinIO configuration missing)';
		}

		this.progressLogger.showCompletion(true, message, details);
	}

	/**
	 * Show failure message
	 */
	private showFailure(error: unknown): void {
		const message: string = error instanceof Error ? error.message : String(error);
		this.progressLogger.showCompletion(false, `Error: ${message}`);
	}
}