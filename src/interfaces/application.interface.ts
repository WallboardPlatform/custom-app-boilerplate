export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Settings extends Record<string, unknown> {
	title: string;
	accentColor: string;
	textColor: string;
	backgroundColor: string;
}

export interface ConfigValues {
	title?: string;
	accentColor?: string;
	textColor?: string;
	backgroundColor?: string;
}
