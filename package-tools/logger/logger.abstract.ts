/**
 * Abstract base logger class
 * Provides common logging functionality that can be extended
 */
import { LogLevel, LoggerConfig, LogMessage } from './types';

export abstract class BaseLogger {
	protected config: LoggerConfig;

	constructor(config: Partial<LoggerConfig> = {}) {
		this.config = {
			showTimestamp: false,
			showIcons: true,
			clearScreen: false,
			useSimpleOutput: false,
			...config
		};
	}

	/**
	 * Update logger configuration
	 */
	public configure(config: Partial<LoggerConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Abstract method to implement actual logging
	 */
	protected abstract output(message: LogMessage): void;

	/**
	 * Format a log message
	 */
	protected abstract formatMessage(message: LogMessage): string;

	/**
	 * Core logging method
	 */
	protected log(level: LogLevel, message: string, ...args: unknown[]): void {
		const logMessage: LogMessage = {
			level,
			message,
			timestamp: new Date(),
			args
		};

		this.output(logMessage);
	}

	/**
	 * Public logging methods
	 */
	public info(message: string, ...args: unknown[]): void {
		this.log(LogLevel.INFO, message, ...args);
	}

	public success(message: string, ...args: unknown[]): void {
		this.log(LogLevel.SUCCESS, message, ...args);
	}

	public warning(message: string, ...args: unknown[]): void {
		this.log(LogLevel.WARNING, message, ...args);
	}

	public error(message: string, ...args: unknown[]): void {
		this.log(LogLevel.ERROR, message, ...args);
	}

	public debug(message: string, ...args: unknown[]): void {
		if (process.env.NODE_ENV === 'development') {
			this.log(LogLevel.DEBUG, message, ...args);
		}
	}

	/**
	 * Utility methods
	 */
	public abstract divider(char?: string, length?: number): void;
	public abstract newline(): void;
	public abstract header(title: string, icon?: string): void;
	public abstract clear(): void;
}