export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'operationsData';
export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export interface DataPickerValues {
	operationsData?: DataSourceValue['value'];
}

export interface MetricRow {
	label: string;
	value: string | number;
	unit?: string;
	delta?: string;
	tone?: 'positive' | 'warning' | 'neutral';
}

export interface TrendPoint {
	label: string;
	value: number;
}

export interface OperationsPayload {
	metrics: MetricRow[];
	history: TrendPoint[];
	updatedAt?: string;
}

export interface Settings extends Record<string, unknown> {
	title: string;
	subtitle: string;
	emptyState: string;
	targetLabel: string;
	targetValue: number;
	fontFamily: string;
	backgroundColor: string;
	surfaceColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	accentColor: string;
	positiveColor: string;
	warningColor: string;
}

export interface ConfigValues extends Record<string, unknown> {
	titleText?: string;
	subtitleText?: string;
	emptyStateText?: string;
	targetLabel?: string;
	targetValue?: number;
	fontFamily?: string;
	backgroundColor?: string;
	surfaceColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	accentColor?: string;
	positiveColor?: string;
	warningColor?: string;
}
