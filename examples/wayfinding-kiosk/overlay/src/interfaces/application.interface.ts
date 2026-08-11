export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Settings extends Record<string, unknown> {
	venueName: string;
	welcomeMessage: string;
	themePreset: 'custom' | 'dark' | 'light';
	accentColor: string;
	textColor: string;
	backgroundColor: string;
	panelColor: string;
	mutedColor: string;
}

export interface ConfigValues {
	venueName?: string;
	welcomeMessage?: string;
	themePreset?: 'custom' | 'dark' | 'light';
	accentColor?: string;
	textColor?: string;
	backgroundColor?: string;
	panelColor?: string;
	mutedColor?: string;
}
