export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<'calendarData', string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export interface DataPickerValues {
	calendarData?: DataSourceValue['value'];
}

export interface DataSources {
	calendarData?: DataSourceValue;
}

export interface Settings extends Record<string, unknown> {
	venueName: string;
	boardTitle: string;
	upcomingTitle: string;
	emptyStateText: string;
	maxUpcoming: number;
	timeFormat: '12h' | '24h';
	showClock: boolean;
	backgroundColor: string;
	panelColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	accentColor: string;
	liveColor: string;
}

export interface ConfigValues {
	venueName?: string;
	boardTitle?: string;
	upcomingTitle?: string;
	emptyStateText?: string;
	maxUpcoming?: number;
	timeFormat?: '12h' | '24h';
	showClock?: boolean;
	backgroundColor?: string;
	panelColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	accentColor?: string;
	liveColor?: string;
}
