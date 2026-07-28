import type {
	ConfigValues,
	DateFormat,
	FontSettings,
	MotionPreset,
	RawFontSettings,
	SemanticPalette,
	Settings,
	SortDirection,
	ThemePreset,
	TimeFormat
} from '@interfaces/application.interface';

const LIGHT_PALETTE: SemanticPalette = {
	backgroundColor: '#dff3e4',
	headerBackgroundColor: '#073c35',
	headerTextColor: '#f7faf7',
	panelColor: '#f7faf7',
	primaryTextColor: '#151a17',
	secondaryTextColor: '#66736d',
	entryField1TextColor: '#161b18',
	entryField2TextColor: '#2f8f46',
	entryField3TextColor: '#6c7772',
	categoryButtonDescriptionTextColor: '#65726c',
	activeCategoryDescriptionTextColor: '#66736d',
	categoryButtonColor: '#f1f5f2',
	categoryButtonTextColor: '#25342e',
	categoryActiveColor: '#ccefd5',
	categoryActiveTextColor: '#153b2b',
	donorCardColor: '#ffffff',
	donorCardBorderColor: '#d7e0d9',
	searchBackgroundColor: '#ffffff',
	searchTextColor: '#18211d',
	searchBorderColor: '#cbd7ce',
	accentColor: '#35a853',
	accentTextColor: '#ffffff',
	keyboardBackgroundColor: '#f6f8f5',
	keyboardKeyColor: '#ffffff',
	keyboardKeyTextColor: '#18211d'
};

const DARK_PALETTE: SemanticPalette = {
	backgroundColor: '#071a17',
	headerBackgroundColor: '#061f1b',
	headerTextColor: '#f7faf7',
	panelColor: '#0f2822',
	primaryTextColor: '#f4f7f4',
	secondaryTextColor: '#aebdb6',
	entryField1TextColor: '#f7faf7',
	entryField2TextColor: '#79d58c',
	entryField3TextColor: '#aebdb6',
	categoryButtonDescriptionTextColor: '#b7c6bf',
	activeCategoryDescriptionTextColor: '#aebdb6',
	categoryButtonColor: '#18362f',
	categoryButtonTextColor: '#e8f0eb',
	categoryActiveColor: '#5bd076',
	categoryActiveTextColor: '#071a17',
	donorCardColor: '#133028',
	donorCardBorderColor: '#315148',
	searchBackgroundColor: '#102a24',
	searchTextColor: '#f4f7f4',
	searchBorderColor: '#3a594f',
	accentColor: '#5bd076',
	accentTextColor: '#071a17',
	keyboardBackgroundColor: '#0c211c',
	keyboardKeyColor: '#19352e',
	keyboardKeyTextColor: '#f4f7f4'
};

const requiredTextSetting = (value: unknown, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const optionalTextSetting = (value: unknown, fallback: string): string => {
	return typeof value === 'string' ? value.trim() : fallback;
};

const booleanSetting = (value: unknown, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

const numberSetting = (value: unknown, fallback: number, minimum: number, maximum: number, integer = true): number => {
	const parsed: number =
		typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
	const finite: number = Number.isFinite(parsed) ? parsed : fallback;
	const clamped: number = Math.min(maximum, Math.max(minimum, finite));

	return integer ? Math.round(clamped) : clamped;
};

const fontSetting = (
	value: RawFontSettings | undefined,
	fallbackFamily: string,
	fallbackWeight: string
): FontSettings => ({
	family: requiredTextSetting(value?.['font-family'], fallbackFamily),
	style: requiredTextSetting(value?.['font-style'], 'normal'),
	weight: requiredTextSetting(value?.['font-weight'], fallbackWeight),
	decoration: requiredTextSetting(value?.['text-decoration'], 'none')
});

const colorSetting = (value: unknown, fallback: string): string => {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalized: string = value.trim().toLowerCase();

	return /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(normalized) ? normalized : fallback;
};

const fileSetting = (value: unknown): string => {
	if (typeof value === 'string') {
		return value.trim();
	}

	if (value && typeof value === 'object') {
		const file: Record<string, unknown> = value as Record<string, unknown>;

		for (const key of ['url', 'src', 'path', 'location']) {
			if (typeof file[key] === 'string' && file[key].trim() !== '') {
				return file[key].trim();
			}
		}
	}

	return '';
};

const localeSetting = (value: unknown): string => {
	const locale: string = requiredTextSetting(value, 'en-US');

	try {
		return Intl.NumberFormat.supportedLocalesOf([locale]).length > 0 ? locale : 'en-US';
	} catch {
		return 'en-US';
	}
};

const timeZoneSetting = (value: unknown): string => {
	const timeZone: string = optionalTextSetting(value, '');

	if (timeZone === '') {
		return '';
	}

	try {
		new Intl.DateTimeFormat('en-US', { timeZone }).format();

		return timeZone;
	} catch {
		return '';
	}
};

const sortDirectionSetting = (value: unknown): SortDirection => {
	return value === 'source' || value === 'descending' ? value : 'ascending';
};

const dateFormatSetting = (value: unknown): DateFormat => {
	return value === 'short' || value === 'none' ? value : 'long';
};

const timeFormatSetting = (value: unknown): TimeFormat => {
	return value === '24-hour' || value === 'none' ? value : '12-hour';
};

const motionPresetSetting = (value: unknown): MotionPreset => {
	return value === 'off' ? 'off' : 'subtle';
};

const themePresetSetting = (value: unknown): ThemePreset => {
	return value === 'dark' || value === 'custom' ? value : 'light';
};

const customPalette = (config: ConfigValues): SemanticPalette => ({
	backgroundColor: colorSetting(config.backgroundColor, LIGHT_PALETTE.backgroundColor),
	headerBackgroundColor: colorSetting(config.headerBackgroundColor, LIGHT_PALETTE.headerBackgroundColor),
	headerTextColor: colorSetting(config.headerTextColor, LIGHT_PALETTE.headerTextColor),
	panelColor: colorSetting(config.panelColor, LIGHT_PALETTE.panelColor),
	primaryTextColor: colorSetting(config.primaryTextColor, LIGHT_PALETTE.primaryTextColor),
	secondaryTextColor: colorSetting(config.secondaryTextColor, LIGHT_PALETTE.secondaryTextColor),
	entryField1TextColor: colorSetting(config.entryField1TextColor, LIGHT_PALETTE.entryField1TextColor),
	entryField2TextColor: colorSetting(config.entryField2TextColor, LIGHT_PALETTE.entryField2TextColor),
	entryField3TextColor: colorSetting(config.entryField3TextColor, LIGHT_PALETTE.entryField3TextColor),
	categoryButtonDescriptionTextColor: colorSetting(
		config.categoryButtonDescriptionTextColor,
		LIGHT_PALETTE.categoryButtonDescriptionTextColor
	),
	activeCategoryDescriptionTextColor: colorSetting(
		config.activeCategoryDescriptionTextColor,
		LIGHT_PALETTE.activeCategoryDescriptionTextColor
	),
	categoryButtonColor: colorSetting(config.categoryButtonColor, LIGHT_PALETTE.categoryButtonColor),
	categoryButtonTextColor: colorSetting(config.categoryButtonTextColor, LIGHT_PALETTE.categoryButtonTextColor),
	categoryActiveColor: colorSetting(config.categoryActiveColor, LIGHT_PALETTE.categoryActiveColor),
	categoryActiveTextColor: colorSetting(config.categoryActiveTextColor, LIGHT_PALETTE.categoryActiveTextColor),
	donorCardColor: colorSetting(config.donorCardColor, LIGHT_PALETTE.donorCardColor),
	donorCardBorderColor: colorSetting(config.donorCardBorderColor, LIGHT_PALETTE.donorCardBorderColor),
	searchBackgroundColor: colorSetting(config.searchBackgroundColor, LIGHT_PALETTE.searchBackgroundColor),
	searchTextColor: colorSetting(config.searchTextColor, LIGHT_PALETTE.searchTextColor),
	searchBorderColor: colorSetting(config.searchBorderColor, LIGHT_PALETTE.searchBorderColor),
	accentColor: colorSetting(config.accentColor, LIGHT_PALETTE.accentColor),
	accentTextColor: colorSetting(config.accentTextColor, LIGHT_PALETTE.accentTextColor),
	keyboardBackgroundColor: colorSetting(config.keyboardBackgroundColor, LIGHT_PALETTE.keyboardBackgroundColor),
	keyboardKeyColor: colorSetting(config.keyboardKeyColor, LIGHT_PALETTE.keyboardKeyColor),
	keyboardKeyTextColor: colorSetting(config.keyboardKeyTextColor, LIGHT_PALETTE.keyboardKeyTextColor)
});

const resolvePalette = (preset: ThemePreset, config: ConfigValues): SemanticPalette => {
	if (preset === 'dark') {
		return DARK_PALETTE;
	}

	if (preset === 'custom') {
		return customPalette(config);
	}

	return LIGHT_PALETTE;
};

export default (config: ConfigValues): Settings => {
	const themePreset: ThemePreset = themePresetSetting(config.themePreset);
	const legacyDisplayFamily: string = requiredTextSetting(config.fontFamily, 'Georgia, Times New Roman, serif');
	const legacyCategoryFamily: string = requiredTextSetting(config.categoryFontFamily, 'Arial, Helvetica, sans-serif');
	const entryField1Column: string = requiredTextSetting(
		config.entryField1Column,
		requiredTextSetting(config.nameColumn, 'Name')
	);
	const entryField2Column: string = optionalTextSetting(
		config.entryField2Column,
		config.showAmount === false ? '' : optionalTextSetting(config.amountColumn, 'Amount')
	);
	const entryField3Column: string = optionalTextSetting(
		config.entryField3Column,
		config.showExtraText === true ? optionalTextSetting(config.extraTextColumn, '') : ''
	);

	return {
		donorTableName: requiredTextSetting(config.donorTableName, 'Donor Information'),
		categoryColumn: requiredTextSetting(config.categoryColumn, 'Category'),
		entryField1Column,
		entryField2Column,
		entryField3Column,
		sortColumn: optionalTextSetting(config.sortColumn, 'Name'),
		sortDirection: sortDirectionSetting(config.sortDirection),
		directoryColumns: numberSetting(config.directoryColumns, 3, 1, 4),
		entriesPerColumn: numberSetting(config.entriesPerColumn, 8, 1, 20),
		maximumRowHeight: numberSetting(config.maximumRowHeight, 0, 0, 320),
		numberLocale: localeSetting(config.numberLocale),
		formatNumberColumnsAsCurrency: booleanSetting(config.formatNumberColumnsAsCurrency, false),
		currencySymbol: optionalTextSetting(config.currencySymbol, '$'),
		categoryTableName: requiredTextSetting(config.categoryTableName, 'Categories'),
		categoryKeyColumn: requiredTextSetting(config.categoryKeyColumn, 'Category'),
		categoryLabelColumn: optionalTextSetting(config.categoryLabelColumn, 'Label'),
		categoryDescriptionColumn: optionalTextSetting(config.categoryDescriptionColumn, 'Description'),
		categoryOrderColumn: optionalTextSetting(config.categoryOrderColumn, 'Order'),
		title: requiredTextSetting(config.title, 'Our Donors'),
		titleFontSize: numberSetting(config.titleFontSize, 46, 18, 72),
		subtitle: optionalTextSetting(config.subtitle, 'With gratitude to those who make our work possible'),
		allLabel: requiredTextSetting(config.allLabel, 'All Donors'),
		allLabelFontSize: numberSetting(config.allLabelFontSize, 27, 12, 64),
		emptyStateText: requiredTextSetting(config.emptyStateText, 'No donor records are available.'),
		noResultsText: requiredTextSetting(config.noResultsText, 'No donors match your search.'),
		searchPlaceholder: requiredTextSetting(config.searchPlaceholder, 'Search donor names'),
		logo: fileSetting(config.logo),
		logoScale: numberSetting(config.logoScale, 72, 32, 180),
		dateFormat: dateFormatSetting(config.dateFormat),
		timeFormat: timeFormatSetting(config.timeFormat),
		timeZone: timeZoneSetting(config.timeZone),
		showKeyboard: booleanSetting(config.showKeyboard, true),
		showCategoryButtonDescriptions: booleanSetting(config.showCategoryButtonDescriptions, false),
		autoplayIntervalSeconds: numberSetting(config.autoplayIntervalSeconds, 8, 3, 120),
		stopAtEnd: booleanSetting(config.stopAtEnd, false),
		motionPreset: motionPresetSetting(config.motionPreset),
		themePreset,
		backgroundImage: fileSetting(config.backgroundImage),
		backgroundOverlayColor: colorSetting(config.backgroundOverlayColor, '#000000'),
		backgroundOverlayOpacity: numberSetting(config.backgroundOverlayOpacity, 0, 0, 100),
		displayFont: fontSetting(config.displayFont, legacyDisplayFamily, '500'),
		interfaceFont: fontSetting(config.interfaceFont, 'Arial, Helvetica, sans-serif', '500'),
		categoryFont: fontSetting(config.categoryFont, legacyCategoryFamily, '600'),
		categoryMaxFontSize: numberSetting(config.categoryMaxFontSize, 18, 12, 40),
		categoryButtonDescriptionFont: fontSetting(
			config.categoryButtonDescriptionFont,
			'Arial, Helvetica, sans-serif',
			'500'
		),
		categoryButtonDescriptionMaxFontSize: numberSetting(config.categoryButtonDescriptionMaxFontSize, 14, 14, 28),
		activeCategoryDescriptionFont: fontSetting(
			config.activeCategoryDescriptionFont,
			'Arial, Helvetica, sans-serif',
			'500'
		),
		activeCategoryDescriptionMaxFontSize: numberSetting(config.activeCategoryDescriptionMaxFontSize, 14, 14, 32),
		entryField1Font: fontSetting(config.entryField1Font, legacyDisplayFamily, '500'),
		entryField1MaxFontSize: numberSetting(config.entryField1MaxFontSize, 28, 18, 56),
		entryField2Font: fontSetting(config.entryField2Font, 'Arial, Helvetica, sans-serif', '600'),
		entryField2MaxFontSize: numberSetting(config.entryField2MaxFontSize, 18, 14, 40),
		entryField3Font: fontSetting(config.entryField3Font, 'Arial, Helvetica, sans-serif', '500'),
		entryField3MaxFontSize: numberSetting(config.entryField3MaxFontSize, 14, 11, 32),
		cornerRadius: numberSetting(config.cornerRadius, 18, 0, 32),
		...resolvePalette(themePreset, config)
	};
};
