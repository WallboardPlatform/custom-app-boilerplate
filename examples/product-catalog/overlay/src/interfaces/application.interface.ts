export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'products' | 'productImages';

export interface DataPickerValues {
	products?: DataSourceValue['value'];
	productImages?: DataSourceValue['value'];
}

export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export interface Settings extends Record<string, unknown> {
	brandLabel: string;
	collectionTitle: string;
	emptyStateText: string;
	pageDurationSeconds: number;
	motionPreset: 'off' | 'subtle' | 'expressive';
	mediaFit: 'cover' | 'contain';
	backgroundColor: string;
	textColor: string;
	mutedTextColor: string;
	accentColor: string;
	panelColor: string;
}

export interface ConfigValues {
	brandLabel?: string;
	collectionTitle?: string;
	emptyStateText?: string;
	pageDurationSeconds?: number;
	motionPreset?: string;
	mediaFit?: string;
	backgroundColor?: string;
	textColor?: string;
	mutedTextColor?: string;
	accentColor?: string;
	panelColor?: string;
}
