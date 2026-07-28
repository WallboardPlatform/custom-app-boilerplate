export interface Config {
	configValues: ConfigValues;
	dataPickerValues?: DataPickerValues;
	datasourceIds?: Partial<Record<DataSourceKey, string | number>>;
}

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSourceKey = 'donorData' | 'categoryData';

export interface DataPickerValues {
	donorData?: DataSourceValue['value'];
	categoryData?: DataSourceValue['value'];
}

export type DataSources = { [K in DataSourceKey]?: DataSourceValue };

export type AmountFormat = 'currency' | 'number' | 'raw';
export type DateFormat = 'long' | 'short' | 'none';
export type MotionPreset = 'off' | 'subtle';
export type SortDirection = 'source' | 'ascending' | 'descending';
export type ThemePreset = 'light' | 'dark' | 'custom';
export type TimeFormat = '12-hour' | '24-hour' | 'none';

export interface FontSettings {
	family: string;
	style: string;
	weight: string;
	decoration: string;
}

export interface RawFontSettings extends Record<string, string | number | undefined> {
	'font-family'?: string;
	'font-size'?: string | number;
	'font-style'?: string;
	'font-weight'?: string | number;
	'text-decoration'?: string;
}

export interface SemanticPalette {
	backgroundColor: string;
	headerBackgroundColor: string;
	headerTextColor: string;
	panelColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	entryField1TextColor: string;
	entryField2TextColor: string;
	entryField3TextColor: string;
	categoryButtonDescriptionTextColor: string;
	activeCategoryDescriptionTextColor: string;
	categoryButtonColor: string;
	categoryButtonTextColor: string;
	categoryActiveColor: string;
	categoryActiveTextColor: string;
	donorCardColor: string;
	donorCardBorderColor: string;
	searchBackgroundColor: string;
	searchTextColor: string;
	searchBorderColor: string;
	accentColor: string;
	accentTextColor: string;
	keyboardBackgroundColor: string;
	keyboardKeyColor: string;
	keyboardKeyTextColor: string;
}

export interface Settings extends SemanticPalette, Record<string, unknown> {
	donorTableName: string;
	categoryColumn: string;
	entryField1Column: string;
	entryField2Column: string;
	entryField3Column: string;
	sortColumn: string;
	sortDirection: SortDirection;
	directoryColumns: number;
	entriesPerColumn: number;
	maximumRowHeight: number;
	numberLocale: string;
	formatNumberColumnsAsCurrency: boolean;
	currencySymbol: string;
	categoryTableName: string;
	categoryKeyColumn: string;
	categoryLabelColumn: string;
	categoryDescriptionColumn: string;
	categoryOrderColumn: string;
	title: string;
	titleFontSize: number;
	subtitle: string;
	allLabel: string;
	allLabelFontSize: number;
	emptyStateText: string;
	noResultsText: string;
	searchPlaceholder: string;
	logo: string;
	logoScale: number;
	dateFormat: DateFormat;
	timeFormat: TimeFormat;
	timeZone: string;
	showKeyboard: boolean;
	showCategoryButtonDescriptions: boolean;
	autoplayIntervalSeconds: number;
	stopAtEnd: boolean;
	motionPreset: MotionPreset;
	themePreset: ThemePreset;
	backgroundImage: string;
	backgroundOverlayColor: string;
	backgroundOverlayOpacity: number;
	displayFont: FontSettings;
	interfaceFont: FontSettings;
	categoryFont: FontSettings;
	categoryMaxFontSize: number;
	categoryButtonDescriptionFont: FontSettings;
	categoryButtonDescriptionMaxFontSize: number;
	activeCategoryDescriptionFont: FontSettings;
	activeCategoryDescriptionMaxFontSize: number;
	entryField1Font: FontSettings;
	entryField1MaxFontSize: number;
	entryField2Font: FontSettings;
	entryField2MaxFontSize: number;
	entryField3Font: FontSettings;
	entryField3MaxFontSize: number;
	cornerRadius: number;
}

export interface ConfigValues {
	donorTableName?: string;
	categoryColumn?: string;
	entryField1Column?: string;
	entryField2Column?: string;
	entryField3Column?: string;
	sortColumn?: string;
	sortDirection?: string;
	directoryColumns?: number;
	entriesPerColumn?: number;
	maximumRowHeight?: number;
	numberLocale?: string;
	formatNumberColumnsAsCurrency?: boolean;
	currencySymbol?: string;
	categoryTableName?: string;
	categoryKeyColumn?: string;
	categoryLabelColumn?: string;
	categoryDescriptionColumn?: string;
	categoryOrderColumn?: string;
	title?: string;
	titleFontSize?: number;
	subtitle?: string;
	allLabel?: string;
	allLabelFontSize?: number;
	emptyStateText?: string;
	noResultsText?: string;
	searchPlaceholder?: string;
	logo?: unknown;
	logoScale?: number;
	dateFormat?: string;
	timeFormat?: string;
	timeZone?: string;
	showKeyboard?: boolean;
	showCategoryButtonDescriptions?: boolean;
	autoplayIntervalSeconds?: number;
	stopAtEnd?: boolean;
	motionPreset?: string;
	themePreset?: string;
	backgroundImage?: unknown;
	backgroundOverlayColor?: string;
	backgroundOverlayOpacity?: number;
	displayFont?: RawFontSettings;
	interfaceFont?: RawFontSettings;
	categoryFont?: RawFontSettings;
	categoryMaxFontSize?: number;
	categoryButtonDescriptionFont?: RawFontSettings;
	categoryButtonDescriptionMaxFontSize?: number;
	activeCategoryDescriptionFont?: RawFontSettings;
	activeCategoryDescriptionMaxFontSize?: number;
	entryField1Font?: RawFontSettings;
	entryField1MaxFontSize?: number;
	entryField2Font?: RawFontSettings;
	entryField2MaxFontSize?: number;
	entryField3Font?: RawFontSettings;
	entryField3MaxFontSize?: number;
	cornerRadius?: number;
	backgroundColor?: string;
	headerBackgroundColor?: string;
	headerTextColor?: string;
	panelColor?: string;
	primaryTextColor?: string;
	secondaryTextColor?: string;
	entryField1TextColor?: string;
	entryField2TextColor?: string;
	entryField3TextColor?: string;
	categoryButtonDescriptionTextColor?: string;
	activeCategoryDescriptionTextColor?: string;
	categoryButtonColor?: string;
	categoryButtonTextColor?: string;
	categoryActiveColor?: string;
	categoryActiveTextColor?: string;
	donorCardColor?: string;
	donorCardBorderColor?: string;
	searchBackgroundColor?: string;
	searchTextColor?: string;
	searchBorderColor?: string;
	accentColor?: string;
	accentTextColor?: string;
	keyboardBackgroundColor?: string;
	keyboardKeyColor?: string;
	keyboardKeyTextColor?: string;
	nameColumn?: string;
	amountColumn?: string;
	extraTextColumn?: string;
	showAmount?: boolean;
	showExtraText?: boolean;
	amountFormat?: string;
	currencyCode?: string;
	fontFamily?: string;
	categoryFontFamily?: string;
}
