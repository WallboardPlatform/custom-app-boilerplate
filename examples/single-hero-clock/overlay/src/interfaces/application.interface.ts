export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export type HourFormat = '12' | '24';
export type DateFormat = 'compact' | 'medium' | 'long';

export interface Settings extends Record<string, unknown> {
	locationLabel: string;
	timezone: string;
	hourFormat: HourFormat;
	dateFormat: DateFormat;
	showSeconds: boolean;
	showDate: boolean;
	showZone: boolean;
	fontScale: number;
	accentColor: string;
	textColor: string;
	backgroundColor: string;
	backgroundOpacity: number;
}

export interface ConfigValues {
	locationLabel?: string;
	timezone?: string;
	hourFormat?: string;
	dateFormat?: string;
	showSeconds?: boolean;
	showDate?: boolean;
	showZone?: boolean;
	fontScale?: number;
	accentColor?: string;
	textColor?: string;
	backgroundColor?: string;
	backgroundOpacity?: number;
}
