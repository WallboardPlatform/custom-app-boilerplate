export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Settings extends Record<string, unknown> {
	studioName: string;
	wallTitle: string;
	emptyStateText: string;
	pageDurationSeconds: number;
	showQuotes: boolean;
	themePreset: 'dark' | 'light' | 'custom';
	backgroundColor: string;
	surfaceColor: string;
	accentColor: string;
	textColor: string;
	mutedTextColor: string;
	highlightColor: string;
	coolColor: string;
	surfaceInkColor: string;
	accentInkColor: string;
	highlightInkColor: string;
	coolInkColor: string;
}

export interface ConfigValues {
	studioName?: string;
	wallTitle?: string;
	emptyStateText?: string;
	pageDurationSeconds?: number;
	showQuotes?: boolean;
	themePreset?: string;
	backgroundColor?: string;
	surfaceColor?: string;
	accentColor?: string;
	textColor?: string;
	mutedTextColor?: string;
	highlightColor?: string;
	coolColor?: string;
}
