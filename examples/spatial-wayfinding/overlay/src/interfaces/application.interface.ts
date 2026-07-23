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
	accentColor?: string;
	backgroundColor?: string;
	defaultView?: string;
	motionPreset?: string;
	panelColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	showViewSwitcher?: boolean;
	themePreset?: string;
	title?: string;
}

export interface Settings extends Record<string, unknown> {
	accentColor: string;
	backgroundColor: string;
	defaultView: '2d' | '3d';
	motionPreset: MotionPreset;
	panelColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	showViewSwitcher: boolean;
	themePreset: ThemePreset;
	title: string;
}
