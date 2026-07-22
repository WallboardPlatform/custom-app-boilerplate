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
export type FloorId = '1' | '2' | '3';
export type InterfaceLanguages = 'en' | 'es' | 'en-es';
export type KeyboardLanguages = 'en' | 'es' | 'en-es';

export interface Settings extends Record<string, unknown> {
	accentColor: string;
	backgroundColor: string;
	destinationColor: string;
	emptyStateText: string;
	guidanceMode: 'directory' | 'highlight' | 'route';
	initialFloor: FloorId;
	interfaceLanguages: InterfaceLanguages;
	keyboardLanguages: KeyboardLanguages;
	mapSurfaceColor: string;
	motionPreset: MotionPreset;
	onScreenKeyboard: boolean;
	panelColor: string;
	primaryTextColor: string;
	routeColor: string;
	secondaryTextColor: string;
	selectionResetSeconds: number;
	startLocationId: string;
	subtitle: string;
	themePreset: ThemePreset;
	title: string;
}

export interface ConfigValues {
	accentColor?: string;
	backgroundColor?: string;
	destinationColor?: string;
	emptyStateText?: string;
	guidanceMode?: string;
	initialFloor?: string;
	interfaceLanguages?: string;
	keyboardLanguages?: string;
	mapSurfaceColor?: string;
	motionPreset?: string;
	onScreenKeyboard?: boolean;
	panelColor?: string;
	primaryTextColor?: string;
	routeColor?: string;
	secondaryTextColor?: string;
	selectionResetSeconds?: number;
	startLocationId?: string;
	subtitle?: string;
	themePreset?: string;
	title?: string;
}
