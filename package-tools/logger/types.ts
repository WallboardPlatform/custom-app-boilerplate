export enum LogLevel {
	INFO = 'INFO',
	SUCCESS = 'SUCCESS',
	WARNING = 'WARNING',
	ERROR = 'ERROR',
	DEBUG = 'DEBUG'
}

export interface LoggerConfig {
	showTimestamp?: boolean;
	showIcons?: boolean;
	clearScreen?: boolean;
	useSimpleOutput?: boolean;
}

export interface LogMessage {
	level: LogLevel;
	message: string;
	timestamp: Date;
	args?: unknown[];
}

export interface ProgressState {
	current: number;
	total: number;
	label?: string;
	startTime?: number;
}

export interface StepState {
	currentStep: number;
	totalSteps: number;
	description: string;
}

export const LOG_ICONS: Record<LogLevel, string> = {
	[LogLevel.INFO]: '📋',
	[LogLevel.SUCCESS]: '✅',
	[LogLevel.WARNING]: '⚠️',
	[LogLevel.ERROR]: '❌',
	[LogLevel.DEBUG]: '🔍'
};

export const LOG_COLORS: Record<LogLevel | 'RESET', string> = {
	[LogLevel.INFO]: '\x1b[36m',      // Cyan
	[LogLevel.SUCCESS]: '\x1b[32m',   // Green
	[LogLevel.WARNING]: '\x1b[33m',   // Yellow
	[LogLevel.ERROR]: '\x1b[31m',     // Red
	[LogLevel.DEBUG]: '\x1b[35m',     // Magenta
	RESET: '\x1b[0m'
};