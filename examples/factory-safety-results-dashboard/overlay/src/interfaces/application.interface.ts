export interface Config {
	configValues: ConfigValues;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}
export type DataSources = Record<string, DataSourceValue>;

export interface SafetyResult {
	completedAt: string;
	corporateId: string;
	participantName: string;
	percentage: number;
	score: number;
	submissionId: string;
	totalQuestions: number;
}

export interface Settings extends Record<string, unknown> {
	accentColor: string;
	backgroundColor: string;
	borderColor: string;
	dangerColor: string;
	fontFamily: string;
	maximumRows: number;
	passColor: string;
	passThreshold: number;
	plantName: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	showCorporateId: boolean;
	surfaceColor: string;
	surfaceStrongColor: string;
	themePreset: 'dark' | 'light' | 'custom';
	title: string;
}

export interface ConfigValues {
	accentColor?: string;
	backgroundColor?: string;
	borderColor?: string;
	dangerColor?: string;
	fontFamily?: string;
	maximumRows?: number;
	passColor?: string;
	passThreshold?: number;
	plantName?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	showCorporateId?: boolean;
	surfaceColor?: string;
	surfaceStrongColor?: string;
	themePreset?: string;
	title?: string;
}
