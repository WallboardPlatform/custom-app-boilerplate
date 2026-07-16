export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<'calendarData' | 'feedData', string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export interface DataPickerValues {
	calendarData?: DataSourceValue['value'];
	feedData?: DataSourceValue['value'];
}

export interface DataSources {
	calendarData?: DataSourceValue;
	feedData?: DataSourceValue;
}

export interface Settings extends Record<string, unknown> {
	venueName: string;
	boardLabel: string;
	emptyStateText: string;
	programRotationSeconds: number;
	announcementFreshHours: number;
	timeFormat: '12h' | '24h';
	showMedia: boolean;
	backgroundColor: string;
	surfaceColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	accentColor: string;
	softAccentColor: string;
}

export interface ConfigValues {
	themePreset?: string;
	venueName?: string;
	boardLabel?: string;
	emptyStateText?: string;
	programRotationSeconds?: number;
	announcementFreshHours?: number;
	timeFormat?: '12h' | '24h';
	showMedia?: boolean;
	backgroundColor?: string;
	surfaceColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	accentColor?: string;
	softAccentColor?: string;
}
