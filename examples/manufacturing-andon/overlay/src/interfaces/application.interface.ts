export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'andonData';

export interface DataPickerValues {
	andonData?: DataSourceValue['value'];
}

export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export interface Settings extends Record<string, unknown> {
	boardTitle: string;
	boardSubtitle: string;
	emptyStateText: string;
	pageDurationSeconds: number;
	themePreset: 'dark' | 'light' | 'custom';
	backgroundColor: string;
	surfaceColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	normalColor: string;
	attentionColor: string;
	stoppedColor: string;
	unknownColor: string;
}

export interface ConfigValues {
	boardTitle?: string;
	boardSubtitle?: string;
	emptyStateText?: string;
	pageDurationSeconds?: number;
	themePreset?: string;
	backgroundColor?: string;
	surfaceColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	normalColor?: string;
	attentionColor?: string;
	stoppedColor?: string;
	unknownColor?: string;
}
