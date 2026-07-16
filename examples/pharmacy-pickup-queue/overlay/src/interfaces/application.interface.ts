export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'queueData';

export interface DataPickerValues {
	queueData?: DataSourceValue['value'];
}

export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export interface Settings extends Record<string, unknown> {
	pharmacyName: string;
	emptyStateText: string;
	themePreset: 'dark' | 'light' | 'custom';
	backgroundColor: string;
	heroBackgroundColor: string;
	surfaceColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	accentColor: string;
	alertColor: string;
	heroTextColor: string;
	heroMutedTextColor: string;
	dividerColor: string;
	accentTextColor: string;
	alertTextColor: string;
}

export interface ConfigValues {
	pharmacyName?: string;
	emptyStateText?: string;
	themePreset?: string;
	backgroundColor?: string;
	heroBackgroundColor?: string;
	surfaceColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	accentColor?: string;
	alertColor?: string;
}
