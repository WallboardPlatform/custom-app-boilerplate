import type { MotionPreset } from '@utils/motion';
import type { ThemePreset } from '@utils/theme';
import type { WayfindingGuidanceMode } from '@utils/wayfinding-guidance';

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
	guidanceMode: WayfindingGuidanceMode;
	interfaceLanguages: 'en' | 'hu' | 'en-hu';
	keyboardLanguages: 'en' | 'hu' | 'hu-en';
	mapNorthOffsetDegrees: number;
	motionPreset: MotionPreset;
	onScreenKeyboard: boolean;
	orientationConfirmed: boolean;
	panelColor: string;
	primaryTextColor: string;
	routeColor: string;
	routeResetSeconds: number;
	secondaryTextColor: string;
	startLocationId: string;
	subtitle: string;
	themePreset: ThemePreset;
	title: string;
	viewerFacingDegrees: number;
}

export interface ConfigValues {
	accentColor?: string;
	backgroundColor?: string;
	emptyStateText?: string;
	guidanceMode?: string;
	interfaceLanguages?: string;
	keyboardLanguages?: string;
	mapNorthOffsetDegrees?: number;
	motionPreset?: string;
	onScreenKeyboard?: boolean;
	orientationConfirmed?: boolean;
	panelColor?: string;
	primaryTextColor?: string;
	routeColor?: string;
	routeResetSeconds?: number;
	secondaryTextColor?: string;
	startLocationId?: string;
	subtitle?: string;
	themePreset?: string;
	title?: string;
	viewerFacingDegrees?: number;
}
