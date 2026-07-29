import type { MotionPreset } from '@utils/motion';
import type { ThemePreset } from '@utils/theme';

export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface ConfigValues {
	scopeTitle?: string;
	memberFilter?: string;
	requirePhoto?: boolean;
	showHeader?: boolean;
	showTicker?: boolean;
	showOfflineZone?: boolean;
	themePreset?: string;
	backgroundColor?: string;
	panelColor?: string;
	wellColor?: string;
	textColor?: string;
	mutedTextColor?: string;
	accentColor?: string;
	motionPreset?: string;
}

export interface Settings extends Record<string, unknown> {
	scopeTitle: string;
	memberFilter: string;
	requirePhoto: boolean;
	showHeader: boolean;
	showTicker: boolean;
	showOfflineZone: boolean;
	themePreset: ThemePreset;
	backgroundColor: string;
	panelColor: string;
	wellColor: string;
	textColor: string;
	mutedTextColor: string;
	accentColor: string;
	dividerColor: string;
	motionPreset: MotionPreset;
}
