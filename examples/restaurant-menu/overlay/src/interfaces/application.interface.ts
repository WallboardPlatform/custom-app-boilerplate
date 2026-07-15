export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'menuData';

export interface DataPickerValues {
	menuData?: DataSourceValue['value'];
}

export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export interface Settings extends Record<string, unknown> {
	restaurantLabel: string;
	restaurantName: string;
	editionTitle: string;
	editionSubtitle: string;
	storyEyebrow: string;
	storyTitle: string;
	storyDescription: string;
	courseLabel: string;
	courseName: string;
	coursePrice: string;
	closingText: string;
	allergenText: string;
	emptyStateText: string;
	pageDurationSeconds: number;
	backgroundColor: string;
	headerBackgroundColor: string;
	headerTextColor: string;
	storyBackgroundColor: string;
	storyTextColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	accentColor: string;
	accentTextColor: string;
	lineColor: string;
	featuredColor: string;
}

export interface ConfigValues {
	restaurantLabel?: string;
	restaurantName?: string;
	editionTitle?: string;
	editionSubtitle?: string;
	storyEyebrow?: string;
	storyTitle?: string;
	storyDescription?: string;
	courseLabel?: string;
	courseName?: string;
	coursePrice?: string;
	closingText?: string;
	allergenText?: string;
	emptyStateText?: string;
	pageDurationSeconds?: number;
	themePreset?: string;
	backgroundColor?: string;
	headerBackgroundColor?: string;
	headerTextColor?: string;
	storyBackgroundColor?: string;
	storyTextColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	accentColor?: string;
	accentTextColor?: string;
	lineColor?: string;
	featuredColor?: string;
}
