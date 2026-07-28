export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export type HourFormat = '12' | '24';

export interface Settings extends Record<string, unknown> {
	boardTitle: string;
	timeFormat: HourFormat;
	showSeconds: boolean;
	showOpenState: boolean;
	emptyStateText: string;
	backgroundColor: string;
	surfaceColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	accentColor: string;
	dividerColor: string;
}

export interface ConfigValues {
	themePreset?: string;
	boardTitle?: string;
	timeFormat?: string;
	showSeconds?: boolean;
	showOpenState?: boolean;
	emptyStateText?: string;
	backgroundColor?: string;
	surfaceColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	accentColor?: string;
	dividerColor?: string;
}
