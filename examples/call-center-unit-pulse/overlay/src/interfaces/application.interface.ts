export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'groupData';
export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export interface DataPickerValues {
	groupData?: DataSourceValue['value'];
}

export interface Settings extends Record<string, unknown> {
	title: string;
	subtitle: string;
	emptyState: string;
	rotationSeconds: number;
	excludedGroups: string;
	hideInactiveGroups: boolean;
	fontFamily: string;
	backgroundColor: string;
	surfaceColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	accentColor: string;
	successColor: string;
	warningColor: string;
	dangerColor: string;
}

export interface ConfigValues extends Record<string, unknown> {
	titleText?: string;
	subtitleText?: string;
	emptyStateText?: string;
	rotationSeconds?: number;
	excludedGroups?: string;
	hideInactiveGroups?: boolean;
	fontFamily?: string;
	backgroundColor?: string;
	surfaceColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	accentColor?: string;
	successColor?: string;
	warningColor?: string;
	dangerColor?: string;
}
