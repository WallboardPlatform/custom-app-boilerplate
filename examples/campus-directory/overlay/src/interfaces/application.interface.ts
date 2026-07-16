import type { ThemePreset } from '@utils/theme';

export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Settings extends Record<string, unknown> {
	themePreset: ThemePreset;
	campusName: string;
	directoryTitle: string;
	locationLabel: string;
	emptyStateText: string;
	pageDurationSeconds: number;
	backgroundColor: string;
	textColor: string;
	accentColor: string;
	accessibilityColor: string;
	secondaryAccentColor: string;
	tertiaryAccentColor: string;
}

export interface ConfigValues {
	themePreset?: string;
	campusName?: string;
	directoryTitle?: string;
	locationLabel?: string;
	emptyStateText?: string;
	pageDurationSeconds?: number;
	backgroundColor?: string;
	textColor?: string;
	accentColor?: string;
	accessibilityColor?: string;
}
