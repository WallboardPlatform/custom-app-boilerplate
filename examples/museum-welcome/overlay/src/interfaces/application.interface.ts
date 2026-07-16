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
	exhibitionTitle: string;
	subtitle: string;
	dateRange: string;
	venue: string;
	heroImage: string;
	showSubtitle: boolean;
	showDate: boolean;
	showVenue: boolean;
	showImage: boolean;
	transparentBackground: boolean;
	themePreset: ThemePreset;
	backgroundColor: string;
	primaryColor: string;
	secondaryColor: string;
	accentColor: string;
	textColor: string;
	inverseTextColor: string;
	groundTextColor: string;
	primaryTextColor: string;
	primaryMetaTextColor: string;
	secondaryTextColor: string;
	accentTextColor: string;
	ringColor: string;
}

export interface ConfigValues {
	exhibitionTitle?: string;
	subtitle?: string;
	dateRange?: string;
	venue?: string;
	heroImage?: unknown;
	showSubtitle?: boolean;
	showDate?: boolean;
	showVenue?: boolean;
	showImage?: boolean;
	transparentBackground?: boolean;
	themePreset?: unknown;
	backgroundColor?: string;
	primaryColor?: string;
	secondaryColor?: string;
	accentColor?: string;
	textColor?: string;
	inverseTextColor?: string;
}
