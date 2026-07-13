/**
 * Abstract base plugin class
 * Provides common functionality for Vite plugins
 */
import { ConsoleLogger } from '../../../logger';
import { VitePluginHooks, BuildEnvironment } from '../types';

export interface BasePluginConfig {
	logger?: ConsoleLogger;
	environment?: BuildEnvironment;
}

export abstract class BasePlugin {
	protected logger: ConsoleLogger;
	protected environment: BuildEnvironment;

	constructor(config: BasePluginConfig = {}) {
		this.logger = config.logger || new ConsoleLogger();
		this.environment = config.environment || {
			isProduction: false,
			isDevelopment: true,
			mode: 'development'
		};
	}

	/**
	 * Get the plugin name
	 */
	protected abstract getPluginName(): string;

	/**
	 * Execute plugin tasks
	 */
	protected abstract executeTasks(): Promise<void>;

	/**
	 * Validate plugin configuration
	 */
	protected abstract validate(): void;

	/**
	 * Get Vite plugin object
	 */
	public getPlugin(): VitePluginHooks {
		return {
			name: this.getPluginName(),
			closeBundle: async (): Promise<void> => {
				try {
					this.validate();
					await this.executeTasks();
				} catch (error) {
					this.handleError(error);
					throw error;
				}
			}
		};
	}

	/**
	 * Handle errors
	 */
	protected handleError(error: unknown): void {
		const message: string = error instanceof Error ? error.message : String(error);
		this.logger.error(`Plugin error: ${message}`);
	}

	/**
	 * Log configuration
	 */
	protected logConfiguration(config: Record<string, unknown>): void {
		this.logger.header('PLUGIN CONFIGURATION', '🔧');

		Object.entries(config).forEach(([key, value]: [string, unknown]): void => {
			if (value !== undefined && value !== null) {
				this.logger.info(`${key}: ${value}`);
			}
		});

		this.logger.divider();
	}

	/**
	 * Helper to create delays
	 */
	protected delay(ms: number): Promise<void> {
		return new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, ms));
	}
}