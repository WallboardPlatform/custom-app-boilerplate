export interface Config {
	configValues: ConfigValues;
	dataPickerValues: DataPickerValues;
	datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'nasdaqData' | 'tsxData' | 'dowData' | 'fxData' | 'stockIcons';

export interface DataPickerValues {
	nasdaqData?: DataSourceValue['value'];
	tsxData?: DataSourceValue['value'];
	dowData?: DataSourceValue['value'];
	fxData?: DataSourceValue['value'];
	stockIcons?: DataSourceValue['value'];
}

export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export interface FontSettings {
	family: string;
	size: number;
	style: string;
	weight: string;
	color: string;
	decoration: string;
}

export interface Settings extends Record<string, unknown> {
	nasdaqLabel: string;
	tsxLabel: string;
	dowLabel: string;
	fxLabel: string;
	exchangeTitleSeconds: number;
	speedPixelsPerSecond: number;
	verticalMargin: number;
	itemMargin: number;
	logoScale: number;
	marketLabelFont: FontSettings;
	tickerFont: FontSettings;
	priceFont: FontSettings;
	changeFont: FontSettings;
	upIconFile?: string;
	downIconFile?: string;
	backgroundColor: string;
	exchangeTitleColor: string;
	upColor: string;
	downColor: string;
	fallbackIconBackground: string;
	emptyStateText: string;
}

export interface RawFontSettings extends Record<string, string | number | undefined> {
	'font-family'?: string;
	'font-size'?: string | number;
	'font-style'?: string;
	'font-weight'?: string | number;
	color?: string;
	'text-decoration'?: string;
}

export interface ConfigValues {
	nasdaqLabel?: string;
	tsxLabel?: string;
	dowLabel?: string;
	fxLabel?: string;
	exchangeTitleSeconds?: number;
	speedPixelsPerSecond?: number;
	verticalMargin?: number;
	itemMargin?: number;
	logoScale?: number;
	marketLabelFont?: RawFontSettings;
	tickerFont?: RawFontSettings;
	priceFont?: RawFontSettings;
	changeFont?: RawFontSettings;
	upIconFile?: string;
	downIconFile?: string;
	backgroundColor?: string;
	exchangeTitleColor?: string;
	upColor?: string;
	downColor?: string;
	fallbackIconBackground?: string;
	emptyStateText?: string;
}
