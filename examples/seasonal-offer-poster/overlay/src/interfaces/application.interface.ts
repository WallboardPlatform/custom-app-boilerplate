export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Settings extends Record<string, unknown> {
	brandName: string;
	canvasColor: string;
	inkColor: string;
	accentColor: string;
	letterboxColor: string;
	rotationSeconds: number;
	showValidity: boolean;
	emptyStateText: string;
}

export interface ConfigValues {
	brandName?: string;
	canvasColor?: string;
	inkColor?: string;
	accentColor?: string;
	letterboxColor?: string;
	rotationSeconds?: number;
	showValidity?: boolean;
	emptyStateText?: string;
}
