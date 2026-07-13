/**
 * Console logger implementation
 * Outputs formatted logs to the console
 */

import { BaseLogger } from './logger.abstract';
import { LogMessage, LOG_ICONS, LOG_COLORS, LogLevel } from './types';

export class ConsoleLogger extends BaseLogger {
	/**
	 * Format a log message with timestamp, icon, and color
	 */
	protected formatMessage(message: LogMessage): string {
		const parts: string[] = [];

		if (this.config.showTimestamp) {
			const timestamp: string = message.timestamp
				.toISOString()
				.split('T')[1]
				.split('.')[0];
			parts.push(`[${timestamp}]`);
		}

		if (this.config.showIcons) {
			parts.push(LOG_ICONS[message.level]);
		}

		parts.push(message.message);

		return parts.join(' ');
	}

	/**
	 * Output to console with colors
	 */
	protected output(message: LogMessage): void {
		if (this.config.clearScreen && message.level !== LogLevel.DEBUG) {
			this.clear();
		}

		const formattedMessage: string = this.formatMessage(message);
		const color: string = LOG_COLORS[message.level];
		const resetColor: string = LOG_COLORS.RESET;

		console.log(`${color}${formattedMessage}${resetColor}`, ...(message.args || []));
	}

	/**
	 * Clear the console
	 */
	public clear(): void {
		console.clear();
	}

	/**
	 * Print a divider line
	 */
	public divider(char: string = '─', length: number = 50): void {
		console.log(char.repeat(length));
	}

	/**
	 * Print a newline
	 */
	public newline(): void {
		console.log();
	}

	/**
	 * Print a formatted header
	 */
	public header(title: string, icon?: string): void {
		this.newline();
		this.divider('═', 50);
		console.log(`${icon ? icon + ' ' : ''}${title}`);
		this.divider('═', 50);
		this.newline();
	}

	/**
	 * Group related log messages
	 */
	public group(title: string, content: () => void): void {
		console.group(title);
		content();
		console.groupEnd();
	}

	/**
	 * Display data in table format
	 */
	public table(data: unknown[], columns?: string[]): void {
		if (columns && Array.isArray(data) && data.length > 0) {
			const filtered: Record<string, unknown>[] = data.map((item: unknown): Record<string, unknown> => {
				const row: Record<string, unknown> = {};
				columns.forEach((col: string): void => {
					if (typeof item === 'object' && item !== null && col in item) {
						row[col] = (item as Record<string, unknown>)[col];
					}
				});
				return row;
			});
			console.table(filtered);
		} else {
			console.table(data);
		}
	}
}