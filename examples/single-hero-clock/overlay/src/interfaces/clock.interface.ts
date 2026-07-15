import type { DateFormat, HourFormat } from '@interfaces/application.interface';

export type ClockLayout = 'compact' | 'standard' | 'square' | 'tall' | 'ultra-wide';

export interface ClockDimensions {
	width: number;
	height: number;
}

export interface ClockFormatOptions {
	timezone: string;
	hourFormat: HourFormat;
	dateFormat: DateFormat;
}

export interface ClockValue {
	hours: string;
	minutes: string;
	seconds: string;
	period: string;
	date: string;
	timezone: string;
	timezoneValid: boolean;
	epochSecond: number;
}
