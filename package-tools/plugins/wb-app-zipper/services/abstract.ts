/**
 * Abstract base service for zipper operations
 * Simplified version with only essential functionality
 */
import { ConsoleLogger } from '../../../logger';
import { ZipResult } from '../types';

export interface ZipperServiceConfig {
	logger?: ConsoleLogger;
}

export abstract class BaseZipperService {
	protected logger: ConsoleLogger;

	constructor(config: ZipperServiceConfig = {}) {
		this.logger = config.logger || new ConsoleLogger();
	}

	/**
	 * Execute the service task
	 */
	public abstract execute(): Promise<void> | Promise<ZipResult> | void;

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