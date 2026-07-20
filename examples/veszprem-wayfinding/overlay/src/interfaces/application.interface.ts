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

export interface Settings extends Record<string, unknown> {
	accentColor: string;
	backgroundColor: string;
	emptyStateText: string;
	mapRatio: number;
	motionPreset: MotionPreset;
	panelColor: string;
	primaryTextColor: string;
	routeColor: string;
	routeResetSeconds: number;
	secondaryTextColor: string;
	startLocationId: string;
	subtitle: string;
	themePreset: ThemePreset;
	title: string;
}

export interface ConfigValues {
	accentColor?: string;
	backgroundColor?: string;
	emptyStateText?: string;
	mapRatio?: number;
	motionPreset?: string;
	panelColor?: string;
	primaryTextColor?: string;
	routeColor?: string;
	routeResetSeconds?: number;
	secondaryTextColor?: string;
	startLocationId?: string;
	subtitle?: string;
	themePreset?: string;
	title?: string;
}
