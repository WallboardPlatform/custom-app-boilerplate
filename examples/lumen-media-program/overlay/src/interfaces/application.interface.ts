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
	advanceOnError: boolean;
	autoplay: boolean;
	backgroundColor: string;
	fit: 'contain' | 'cover' | 'fill';
	muted: boolean;
	mutedTextColor: string;
	playlistJson: string;
	primaryTextColor: string;
	programName: string;
	recursiveFolder: boolean;
	repeat: 'none' | 'item' | 'playlist';
	retryCount: number;
	showCaptions: boolean;
	showChrome: boolean;
	showControls: boolean;
	sourceMode: 'file' | 'folder' | 'playlist';
	startAtSeconds: number;
	themePreset: 'dark' | 'light' | 'custom';
	venueName: string;
	videoFile?: unknown;
	videoFolder?: unknown;
	volume: number;
}

export type ConfigValues = Partial<Settings>;
