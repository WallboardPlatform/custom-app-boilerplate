export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Settings extends Record<string, unknown> {
	accentColor: string;
	backgroundColor: string;
	completionResetSeconds: number;
	identityPrompt: string;
	inactivityResetSeconds: number;
	introText: string;
	motionPreset: 'off' | 'subtle' | 'expressive';
	plantName: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	surfaceColor: string;
	themePreset: 'dark' | 'light' | 'custom';
	welcomeTitle: string;
}

export interface ConfigValues {
	accentColor?: string;
	backgroundColor?: string;
	completionResetSeconds?: number;
	identityPrompt?: string;
	inactivityResetSeconds?: number;
	introText?: string;
	motionPreset?: string;
	plantName?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	surfaceColor?: string;
	themePreset?: string;
	welcomeTitle?: string;
}
