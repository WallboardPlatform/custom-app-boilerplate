export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Settings extends Record<string, unknown> {
	cityCode: string;
	countryCode: string;
	displayName: string;
	temperatureUnit: 'C' | 'F';
	languageCode: string;
	forecastDays: number;
	backgroundType: 'Ocean_and_Rocky_Coast' | 'Urban' | 'Village_and_Countryside' | 'none';
	motionPreset: 'off' | 'subtle';
}

export interface ConfigValues {
	cityCode?: string;
	countryCode?: string;
	displayName?: string;
	temperatureUnit?: string;
	languageCode?: string;
	forecastDays?: number;
	backgroundType?: string;
	motionPreset?: string;
}
