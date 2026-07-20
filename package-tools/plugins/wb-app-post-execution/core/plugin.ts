/**
 * Wallboard App Post Execution Plugin
 * Main plugin class that orchestrates all post-build tasks
 */
import { BasePlugin } from './abstract';
import { ProgressLogger } from '../../../logger';
import { ProgressBarFormatter, MetadataFormatter } from '../../../logger/formatters';
import { AssetsService, Chrome49Service } from '../services';
import { BuildEnvironment, WBPluginMetadata } from '../types';

/**
 * Custom progress logger with build progress display
 */
class WBProgressLogger extends ProgressLogger<WBPluginMetadata> {
	override displayMetadata(): void {
		const metadata: WBPluginMetadata = this.getMetadata();

		// Prepare display metadata (only fields we want to show)
		const displayData: Record<string, unknown> = {};

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
	private progressLogger: WBProgressLogger;
	private readonly totalSteps: number = 2;

	constructor(isProduction: boolean) {
		const environment: BuildEnvironment = {
			isProduction,
			isDevelopment: !isProduction,
			mode: isProduction ? 'production' : 'development'
		};

		super({ environment });

		// Initialize custom progress logger
		this.progressLogger = new WBProgressLogger(
			{
				buildMode: environment.mode
			},
			{
				headerTitle: 'WALLBOARD POST BUILD EXECUTION',
				headerIcon: '🔧',
				useSimpleOutput: process.env.SIMPLE_OUTPUT === 'true' && this.environment.isProduction
			}
		);
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
		// No optional external services are required for local builds.
	}

	/**
	 * Execute all post-build tasks
	 */
	protected async executeTasks(): Promise<void> {
		try {
			await this.copyEditorAssets();
			await this.buildChrome49();

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
	 * Show success message
	 */
	private showSuccess(): void {
		const message: string = 'All build steps completed successfully!';
		this.progressLogger.showCompletion(true, message);
	}

	/**
	 * Show failure message
	 */
	private showFailure(error: unknown): void {
		const message: string = error instanceof Error ? error.message : String(error);
		this.progressLogger.showCompletion(false, `Error: ${message}`);
	}
}
