/**
 * Abstract base service class
 * Provides common functionality for all services
 */
import { ConsoleLogger } from '../../../logger';

export interface ServiceConfig {
	logger?: ConsoleLogger;
}

export abstract class BaseService {
	protected logger: ConsoleLogger;

	constructor(config: ServiceConfig) {
		this.logger = config.logger || new ConsoleLogger();
	}

	/**
	 * Execute the service task
	 */
	public abstract execute(): Promise<void> | void;

	/**
	 * Helper to create delays
	 */
	protected delay(ms: number): Promise<void> {
		return new Promise((resolve): NodeJS.Timeout => setTimeout(resolve, ms));
	}

	/**
	 * Log info message
	 */
	protected logInfo(message: string): void {
		this.logger.info(message);
	}

	/**
	 * Log success message
	 */
	protected logSuccess(message: string): void {
		this.logger.success(message);
	}

	/**
	 * Log warning message
	 */
	protected logWarning(message: string): void {
		this.logger.warning(message);
	}

	/**
	 * Log error message
	 */
	protected logError(message: string): void {
		this.logger.error(message);
	}
}