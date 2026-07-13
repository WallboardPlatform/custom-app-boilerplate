/**
 * Progress bar formatting utilities
 */
export interface ProgressBarOptions {
	width?: number;
	complete?: string;
	incomplete?: string;
	showPercentage?: boolean;
}

export interface TimeEstimate {
	elapsed: number;
	remaining: number;
	total: number;
}

export class ProgressBarFormatter {
	private static readonly DEFAULT_WIDTH: number = 40;
	private static readonly COMPLETE_CHAR: string = '█';
	private static readonly INCOMPLETE_CHAR: string = '░';

	/**
	 * Create a progress bar string
	 */
	public static createBar(
		current: number,
		total: number,
		options: ProgressBarOptions = {}
	): string {
		const {
			width = this.DEFAULT_WIDTH,
			complete = this.COMPLETE_CHAR,
			incomplete = this.INCOMPLETE_CHAR,
			showPercentage = true
		} = options;

		const percentage: number = total > 0 ? Math.round((current / total) * 100) : 0;
		// Clamp percentage between 0 and 100
		const clampedPercentage: number = Math.max(0, Math.min(100, percentage));
		const filledLength: number = Math.round((width * clampedPercentage) / 100);
		const emptyLength: number = Math.max(0, width - filledLength); // Ensure never negative
		const bar: string = complete.repeat(filledLength) + incomplete.repeat(emptyLength);

		return showPercentage ? `[${bar}] ${clampedPercentage}%` : `[${bar}]`;
	}

	/**
	 * Calculate time estimates
	 */
	public static calculateTimeEstimate(
		current: number,
		total: number,
		startTime: number
	): TimeEstimate {
		const elapsed: number = (Date.now() - startTime) / 1000;
		const estimatedTotal: number = current > 0 ? elapsed * (total / current) : 0;
		const remaining: number = Math.max(0, estimatedTotal - elapsed);

		return {
			elapsed,
			remaining,
			total: estimatedTotal
		};
	}

	/**
	 * Format time in seconds to readable string
	 */
	public static formatTime(seconds: number): string {
		if (seconds < 60) {
			return `${seconds.toFixed(1)}s`;
		}

		const minutes: number = Math.floor(seconds / 60);
		const remainingSeconds: number = Math.floor(seconds % 60);
		return `${minutes}m ${remainingSeconds}s`;
	}

	/**
	 * Format file count progress
	 */
	public static formatFileProgress(current: number, total: number): string {
		return `Files: ${current}/${total}`;
	}

	/**
	 * Format percentage
	 */
	public static formatPercentage(current: number, total: number): string {
		const percentage: number = total > 0 ? Math.round((current / total) * 100) : 0;
		return `${percentage}%`;
	}
}