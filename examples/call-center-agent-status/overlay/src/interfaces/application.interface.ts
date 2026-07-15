export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'agentData';
export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export interface DataPickerValues {
	agentData?: DataSourceValue['value'];
}

export interface Settings extends Record<string, unknown> {
	title: string;
	subtitle: string;
	emptyState: string;
	pageDurationSeconds: number;
	fontFamily: string;
	backgroundColor: string;
	surfaceColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	readyColor: string;
	busyColor: string;
	acwColor: string;
	awayColor: string;
	offlineColor: string;
	unknownColor: string;
}

export interface ConfigValues extends Record<string, unknown> {
	titleText?: string;
	subtitleText?: string;
	emptyStateText?: string;
	pageDurationSeconds?: number;
	fontFamily?: string;
	backgroundColor?: string;
	surfaceColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	readyColor?: string;
	busyColor?: string;
	acwColor?: string;
	awayColor?: string;
	offlineColor?: string;
	unknownColor?: string;
}
