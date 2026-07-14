export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<'feedData', string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export interface DataPickerValues {
	feedData?: DataSourceValue['value'];
}

export interface DataSources {
	feedData?: DataSourceValue;
}

export interface Settings extends Record<string, unknown> {
	sourceLabel: string;
	emptyStateText: string;
	rotationSeconds: number;
	maxStories: number;
	showDescription: boolean;
	showTimestamp: boolean;
	imagePosition: 'left' | 'right';
	backgroundColor: string;
	panelColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	accentColor: string;
}

export interface ConfigValues {
	sourceLabel?: string;
	emptyStateText?: string;
	rotationSeconds?: number;
	maxStories?: number;
	showDescription?: boolean;
	showTimestamp?: boolean;
	imagePosition?: 'left' | 'right';
	backgroundColor?: string;
	panelColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	accentColor?: string;
}
