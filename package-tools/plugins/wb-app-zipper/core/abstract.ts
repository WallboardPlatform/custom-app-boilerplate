/**
 * Abstract base plugin for zipper operations
 * Simplified version without unnecessary complexity
 */
import { ConsoleLogger } from '../../../logger';
import { VitePluginHooks } from '../types';

export abstract class BaseZipperPlugin {
	protected logger: ConsoleLogger;

	constructor() {
		this.logger = new ConsoleLogger({
			useSimpleOutput: process.env.SIMPLE_OUTPUT === 'true'
		});
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
	 * Get Vite plugin object
	 */
	public getPlugin(): VitePluginHooks {
		return {
			name: this.getPluginName(),
			closeBundle: async (): Promise<void> => {
				try {
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
	 * Helper to create delays
	 */
	protected delay(ms: number): Promise<void> {
		return new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, ms));
	}
}