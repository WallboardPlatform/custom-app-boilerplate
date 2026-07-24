import type { ThemePreset } from '@utils/theme';

export type StoryTone = 'coral' | 'cobalt' | 'sun' | 'mint';
export type StoryLayout = 'statement' | 'quote' | 'schedule';
export type MotionPreset = 'off' | 'subtle';

export interface StoryItem {
	id: string;
	label: string;
	title: string;
	body: string;
	detail: string;
	tone: StoryTone;
	layout: StoryLayout;
	enabled: boolean;
}

export interface StoryCollection {
	venue: string;
	title: string;
	deck: string;
	stories: StoryItem[];
}

export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Settings extends Record<string, unknown> {
	customContent: StoryCollection;
	rotationSeconds: number;
	showProgress: boolean;
	motionPreset: MotionPreset;
	themePreset: ThemePreset;
	backgroundColor: string;
	surfaceColor: string;
	textColor: string;
	mutedTextColor: string;
	coralColor: string;
	cobaltColor: string;
	sunColor: string;
	mintColor: string;
}

export interface ConfigValues {
	customContent?: unknown;
	rotationSeconds?: number;
	showProgress?: boolean;
	motionPreset?: unknown;
	themePreset?: unknown;
	backgroundColor?: string;
	surfaceColor?: string;
	textColor?: string;
	mutedTextColor?: string;
	coralColor?: string;
	cobaltColor?: string;
	sunColor?: string;
	mintColor?: string;
}
