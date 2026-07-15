export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'departuresData';

export interface DataPickerValues {
	departuresData?: DataSourceValue['value'];
}

export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export interface Settings extends Record<string, unknown> {
	airportCode: string;
	airportName: string;
	boardTitle: string;
	terminalLabel: string;
	informationLabel: string;
	emptyStateText: string;
	pageDurationSeconds: number;
	backgroundColor: string;
	textColor: string;
	accentColor: string;
}

export interface ConfigValues {
	themePreset?: string;
	airportCode?: string;
	airportName?: string;
	boardTitle?: string;
	terminalLabel?: string;
	informationLabel?: string;
	emptyStateText?: string;
	pageDurationSeconds?: number;
	backgroundColor?: string;
	textColor?: string;
	accentColor?: string;
}
