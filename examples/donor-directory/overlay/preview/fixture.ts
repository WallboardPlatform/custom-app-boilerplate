import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

export type PreviewRow = Record<string, unknown>;

export interface PreviewTable {
	connectors: Record<string, unknown>;
	header: Record<string, string>;
	rows: PreviewRow[];
}

const DONOR_HEADER: Record<string, string> = {
	Name: 'string',
	Category: 'dropdown',
	Amount: 'number',
	Recognition: 'string'
};

const CATEGORY_HEADER: Record<string, string> = {
	Category: 'string',
	Label: 'string',
	Description: 'text',
	Order: 'number'
};

const FICTIONAL_NAMES: readonly string[] = [
	'Alina Marlow',
	'Alexandra Vale',
	'Élodie Fern',
	'Eloise Grove',
	'Coraline Alden',
	'Avery Stone',
	'Morgan Vale',
	'Riley North',
	'Jordan Briar',
	'Taylor Lark',
	'Cameron Reed',
	'Quinn Harbor',
	'Parker Elm',
	'Skyler Ash',
	'Robin Marlow',
	'Emerson Field',
	'Dakota Wren',
	'Casey Linden',
	'Reese Sol',
	'Alex Rowan',
	'Hayden Brook',
	'Jamie Cedar',
	'Sage Monroe',
	'Kendall Pine',
	'Drew Hollis',
	'Arden Lake',
	'Marin Bell',
	'Blair Meadow',
	'Finley Grove',
	'Remy Coast',
	'Devon Laurel',
	'Harper Birch',
	'Micah Lake',
	'Shiloh Moss',
	'Rowan Dawn',
	'Bailey Firth',
	'Noel Thorne',
	'Jules Prairie',
	'Wren Harbor',
	'Teagan Bloom',
	'River Clove',
	'Marley Cove',
	'Sidney Rain',
	'Frankie Heath',
	'Kai Bramble',
	'Lane Cypress',
	'Indigo Glen',
	'Charlie Frost',
	'Sam Alder',
	'Billie Ridge',
	'Scout Reed',
	'Phoenix Dune',
	'Gray Linden',
	'Rory Basin',
	'Ari Willow',
	'Justice Shore',
	'Kerry Maple',
	'Darcy Meadow',
	'Milan Forest',
	'Rene Orchard',
	'Toni Creek',
	'Shawn Briar',
	'Lee Haven',
	'Kelly Grove'
];

const BASE_CATEGORIES: readonly string[] = [
	'Founders Circle',
	'Legacy Society',
	'Leadership Circle',
	'Community Friends'
];

export const makeDonorRows = (count: number, categories: readonly string[] = BASE_CATEGORIES): PreviewRow[] => {
	return Array.from({ length: count }, (_value: unknown, index: number): PreviewRow => ({
		Name: FICTIONAL_NAMES[index % FICTIONAL_NAMES.length],
		Category: categories[index % categories.length],
		Amount: Math.max(250, 128_000 - index * 175),
		Recognition: index % 3 === 0 ? 'Founding supporter' : index % 3 === 1 ? 'Annual partner' : '',
		_index: index
	}));
};

export const nativeDonorValue = (rows: readonly PreviewRow[]): Record<string, PreviewTable> => ({
	'Donor Information': {
		header: { ...DONOR_HEADER },
		rows: rows.map((row: PreviewRow): PreviewRow => ({ ...row })),
		connectors: {}
	}
});

export const selectedDonorValue = (rows: readonly PreviewRow[]): PreviewTable => ({
	header: { ...DONOR_HEADER },
	rows: rows.map((row: PreviewRow): PreviewRow => ({ ...row })),
	connectors: {}
});

export const categoryRows: PreviewRow[] = [
	{
		Category: 'Legacy Society',
		Label: 'Heritage Circle',
		Description: 'Recognizing enduring commitments from longtime supporters.',
		Order: 1,
		_index: 1
	},
	{
		Category: 'Founders Circle',
		Label: 'Founding Partners',
		Description: 'Honoring transformational gifts that established new possibilities.',
		Order: 2,
		_index: 2
	},
	{
		Category: 'Community Friends',
		Label: 'Community Circle',
		Description: 'Celebrating neighbors whose generosity strengthens every program.',
		Order: null,
		_index: 3
	},
	{
		Category: 'Leadership Circle',
		Label: 'Leadership Circle',
		Description: 'Recognizing sustained leadership and meaningful annual support.',
		Order: 4,
		_index: 4
	}
];

export const nativeCategoryValue = (rows: readonly PreviewRow[] = categoryRows): Record<string, PreviewTable> => ({
	Categories: {
		header: { ...CATEGORY_HEADER },
		rows: rows.map((row: PreviewRow): PreviewRow => ({ ...row })),
		connectors: {}
	}
});

const logoDataUrl = (background: string, foreground: string, letter: string): string => {
	const svg: string = [
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 72">',
		`<rect width="120" height="72" rx="10" fill="${background}"/>`,
		`<circle cx="34" cy="36" r="20" fill="${foreground}" opacity=".18"/>`,
		`<text x="34" y="47" text-anchor="middle" font-family="Arial" font-size="32" font-weight="700" fill="${foreground}">${letter}</text>`,
		`<path d="M65 25h38M65 36h32M65 47h38" stroke="${foreground}" stroke-width="5" stroke-linecap="round"/>`,
		'</svg>'
	].join('');

	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const backgroundDataUrl = (start: string, end: string, accent: string): string => {
	const svg: string = [
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">',
		'<defs>',
		`<linearGradient id="field" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient>`,
		'</defs>',
		'<rect width="1600" height="900" fill="url(#field)"/>',
		`<circle cx="220" cy="760" r="330" fill="${accent}" opacity=".18"/>`,
		`<circle cx="1430" cy="170" r="280" fill="${accent}" opacity=".12"/>`,
		'</svg>'
	].join('');

	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const defaultLogo: string = logoDataUrl('#f7faf7', '#073c35', 'D');
const alternateLogo: string = logoDataUrl('#073c35', '#f7faf7', 'G');
const customBackground: string = backgroundDataUrl('#d9efe5', '#e8ddf4', '#386d5d');
const alternateBackground: string = backgroundDataUrl('#efe0bd', '#d6e9f4', '#755c2e');

const font = (family: string, weight: string, style = 'normal', decoration = 'none'): Record<string, string> => ({
	'font-family': family,
	'font-style': style,
	'font-weight': weight,
	'text-decoration': decoration
});

export const defaultConfigValues: Record<string, unknown> = {
	donorTableName: 'Donor Information',
	categoryColumn: 'Category',
	entryField1Column: 'Name',
	entryField2Column: 'Amount',
	entryField3Column: '',
	sortColumn: 'Name',
	sortDirection: 'ascending',
	directoryColumns: 3,
	entriesPerColumn: 8,
	maximumRowHeight: 0,
	numberLocale: 'en-US',
	formatNumberColumnsAsCurrency: false,
	currencySymbol: '$',
	categoryTableName: 'Categories',
	categoryKeyColumn: 'Category',
	categoryLabelColumn: 'Label',
	categoryDescriptionColumn: 'Description',
	categoryOrderColumn: 'Order',
	title: 'Our Donors',
	titleFontSize: 46,
	subtitle: 'With gratitude to those who make our work possible',
	allLabel: 'All Donors',
	allLabelFontSize: 27,
	emptyStateText: 'No donor records are available.',
	noResultsText: 'No donors match your search.',
	searchPlaceholder: 'Search donor names',
	logo: defaultLogo,
	logoScale: 72,
	dateFormat: 'long',
	timeFormat: '12-hour',
	timeZone: 'UTC',
	showKeyboard: true,
	showCategoryButtonDescriptions: false,
	autoplayIntervalSeconds: 8,
	stopAtEnd: false,
	motionPreset: 'subtle',
	themePreset: 'light',
	backgroundImage: '',
	backgroundOverlayColor: '#000000',
	backgroundOverlayOpacity: 0,
	displayFont: font('Georgia, Times New Roman, serif', '500'),
	interfaceFont: font('Arial, Helvetica, sans-serif', '500'),
	categoryFont: font('Arial, Helvetica, sans-serif', '600'),
	categoryMaxFontSize: 18,
	categoryButtonDescriptionFont: font('Arial, Helvetica, sans-serif', '500'),
	categoryButtonDescriptionMaxFontSize: 14,
	activeCategoryDescriptionFont: font('Arial, Helvetica, sans-serif', '500'),
	activeCategoryDescriptionMaxFontSize: 14,
	entryField1Font: font('Georgia, Times New Roman, serif', '500'),
	entryField1MaxFontSize: 28,
	entryField2Font: font('Arial, Helvetica, sans-serif', '600'),
	entryField2MaxFontSize: 18,
	entryField3Font: font('Arial, Helvetica, sans-serif', '500'),
	entryField3MaxFontSize: 14,
	cornerRadius: 18,
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

const defaultDonorRows: PreviewRow[] = makeDonorRows(24);
const defaultDataPickers: Record<string, unknown> = {
	donorData: nativeDonorValue(defaultDonorRows),
	categoryData: nativeCategoryValue()
};

const makeFixture = (
	id: string,
	configOverrides: Record<string, unknown> = {},
	dataPickerValues: Record<string, unknown> = defaultDataPickers
): PreviewFixture => ({
	id: `donor-directory-${id}`,
	readySelector: '[data-preview-id="donor-directory-root"]',
	settleMs: 700,
	configValues: { ...defaultConfigValues, ...configOverrides },
	dataPickerValues,
	datasourceIds: Object.keys(dataPickerValues).reduce<Record<string, string>>(
		(ids: Record<string, string>, property: string): Record<string, string> => {
			ids[property] = `fictional-${property}`;

			return ids;
		},
		{}
	),
	additionalConfig: {
		licenseType: null,
		mockDatasource: {},
		style: {}
	}
});

const coverage = (width = 84, height = 84): { width: number; height: number } => ({
	width,
	height
});

const longRows: PreviewRow[] = makeDonorRows(48).map((row: PreviewRow, index: number): PreviewRow => ({
	...row,
	Name:
		index === 0
			? 'Alexandria Penelope Montgomery-Willowbrook and Family'
			: `${row.Name as string} Family Foundation for Community Learning`,
	Category:
		index % 2 === 0
			? 'Visionary Community Transformation Partnership'
			: 'Intergenerational Arts and Education Benefactors',
	Recognition:
		index % 2 === 0 ? 'Multi-generational founding and education partner' : 'Community learning and arts benefactor'
}));

const longCategoryRows: PreviewRow[] = [
	{
		Category: 'Visionary Community Transformation Partnership',
		Label: 'Visionary Community Transformation Partners',
		Description:
			'Honoring extraordinary multi-generational commitments that create welcoming cultural and educational opportunities across the entire region.',
		Order: 1,
		_index: 1
	},
	{
		Category: 'Intergenerational Arts and Education Benefactors',
		Label: 'Intergenerational Arts and Education Benefactors',
		Description:
			'Celebrating sustained support for hands-on learning, access, creative discovery, and enduring community connection.',
		Order: 2,
		_index: 2
	}
];

const maximumCategories: readonly string[] = [
	'Founders Circle',
	'Legacy Society',
	'Leadership Circle',
	'Community Friends',
	'Discovery Guild',
	'Learning Partners',
	'Garden Stewards',
	'Future Builders',
	'Heritage Champions'
];

const maximumCategoryRows: PreviewRow[] = maximumCategories.map((category: string, index: number): PreviewRow => ({
	Category: category,
	Label: category,
	Description: `Fictional recognition group ${index + 1}.`,
	Order: index + 1,
	_index: index
}));

const liveDonorRows: PreviewRow[] = [
	{
		...makeDonorRows(1)[0],
		Name: 'Aero Bloom',
		Category: 'Founders Circle',
		Amount: 132_500,
		_index: 0
	},
	...makeDonorRows(15)
];

const liveCategoryRows: PreviewRow[] = categoryRows.map((row: PreviewRow): PreviewRow =>
	row.Category === 'Founders Circle'
		? {
				...row,
				Description: 'Updated recognition description.',
				Order: 1
			}
		: row
);

const scenario = (
	id: string,
	viewport: PreviewScenario['viewport'],
	fixture: PreviewFixture,
	options: Pick<PreviewScenario, 'interactionSteps' | 'advanceTimeMs' | 'liveDatasourceUpdate'> = {},
	minimumContentCoverage = coverage()
): PreviewScenario => ({
	id,
	fixture,
	viewport,
	minimumContentCoverage,
	...options
});

export const previewScenarios: PreviewScenario[] = [
	scenario(
		'app-default',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture('app-default'),
		{},
		coverage(93, 88)
	),
	scenario(
		'compact-landscape',
		{ width: 1280, height: 720, background: 'light' },
		makeFixture('compact-landscape'),
		{},
		coverage(93, 88)
	),
	scenario(
		'portrait',
		{ width: 1080, height: 1920, background: 'dark' },
		makeFixture('portrait'),
		{},
		coverage(93, 91)
	),
	scenario(
		'portrait-many-categories',
		{ width: 1080, height: 1920, background: 'dark' },
		makeFixture(
			'portrait-many-categories',
			{
				directoryColumns: 3,
				showCategoryButtonDescriptions: true
			},
			{
				donorData: nativeDonorValue(makeDonorRows(90, maximumCategories)),
				categoryData: nativeCategoryValue(maximumCategoryRows)
			}
		),
		{},
		coverage(93, 91)
	),
	scenario('square', { width: 1080, height: 1080, background: 'checker' }, makeFixture('square'), {}, coverage(93, 88)),
	scenario(
		'dark-theme',
		{ width: 1920, height: 1080, background: 'dark' },
		makeFixture('dark-theme', { themePreset: 'dark' }),
		{},
		coverage(93, 88)
	),
	scenario(
		'custom-theme',
		{ width: 1920, height: 1080, background: 'light' },
		makeFixture('custom-theme', {
			themePreset: 'custom',
			backgroundImage: { location: customBackground },
			backgroundOverlayColor: '#173f37',
			backgroundOverlayOpacity: 18,
			backgroundColor: '#e4f3eb',
			headerBackgroundColor: '#173f37',
			headerTextColor: '#fffdf6',
			panelColor: '#fffdf8',
			primaryTextColor: '#17231e',
			secondaryTextColor: '#64746d'
		}),
		{},
		coverage(93, 88)
	),
	scenario(
		'unbound',
		{ width: 1280, height: 720, background: 'checker' },
		makeFixture('unbound', {}, {}),
		{},
		coverage(93, 88)
	),
	scenario(
		'empty-donors',
		{ width: 1280, height: 720, background: 'light' },
		makeFixture(
			'empty-donors',
			{},
			{
				donorData: nativeDonorValue([]),
				categoryData: nativeCategoryValue()
			}
		),
		{},
		coverage(93, 88)
	),
	scenario(
		'invalid-mapping',
		{ width: 1280, height: 720, background: 'checker' },
		makeFixture('invalid-mapping', { entryField1Column: 'Display Name' }),
		{},
		coverage(93, 88)
	),
	scenario(
		'category-metadata-unbound',
		{ width: 1280, height: 720, background: 'light' },
		makeFixture(
			'category-metadata-unbound',
			{},
			{
				donorData: nativeDonorValue(defaultDonorRows)
			}
		),
		{},
		coverage(93, 88)
	),
	scenario(
		'category-metadata-order',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture('category-metadata-order', { showCategoryButtonDescriptions: true }),
		{ interactionSteps: [{ type: 'click', role: 'button', name: 'Founding Partners' }] },
		coverage(93, 88)
	),
	scenario(
		'three-field-entries',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture('three-field-entries', {
			entryField1Column: 'Name',
			entryField2Column: 'Amount',
			entryField3Column: 'Recognition'
		}),
		{},
		coverage(93, 88)
	),
	scenario(
		'currency-number-columns',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture('currency-number-columns', {
			entryField1Column: 'Name',
			entryField2Column: 'Amount',
			entryField3Column: 'Recognition',
			formatNumberColumnsAsCurrency: true,
			currencySymbol: '$'
		}),
		{},
		coverage(93, 88)
	),
	scenario(
		'single-field-long',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture(
			'single-field-long',
			{
				entryField2Column: '',
				entryField3Column: '',
				entriesPerColumn: 12
			},
			{
				donorData: nativeDonorValue([
					{
						Name: 'Alexandria Penelope Montgomery-Willowbrook and Family Foundation for Community Learning',
						Category: 'Founders Circle',
						Amount: 128_000,
						Recognition: '',
						_index: 0
					},
					...makeDonorRows(35)
				]),
				categoryData: nativeCategoryValue()
			}
		),
		{},
		coverage(93, 88)
	),
	scenario(
		'keyboard-open',
		{ width: 1280, height: 720, background: 'light' },
		makeFixture('keyboard-open'),
		{ interactionSteps: [{ type: 'click', role: 'button', name: 'Open touch keyboard' }] },
		coverage(93, 88)
	),
	scenario(
		'search-active',
		{ width: 1280, height: 720, background: 'light' },
		makeFixture('search-active'),
		{
			interactionSteps: [
				{ type: 'click', role: 'button', name: 'Open touch keyboard' },
				{ type: 'click', role: 'button', name: 'Key A' },
				{ type: 'click', role: 'button', name: 'Key L' }
			]
		},
		coverage(93, 88)
	),
	scenario(
		'search-no-results',
		{ width: 1280, height: 720, background: 'checker' },
		makeFixture('search-no-results'),
		{
			interactionSteps: [
				{ type: 'click', role: 'button', name: 'Open touch keyboard' },
				{ type: 'click', role: 'button', name: 'Key Z' },
				{ type: 'click', role: 'button', name: 'Key X' },
				{ type: 'click', role: 'button', name: 'Key Q' }
			]
		},
		coverage(93, 88)
	),
	scenario(
		'density-20',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture(
			'density-20',
			{
				directoryColumns: 4,
				entriesPerColumn: 20,
				entryField3Column: 'Recognition'
			},
			{
				donorData: nativeDonorValue(makeDonorRows(160)),
				categoryData: nativeCategoryValue()
			}
		),
		{},
		coverage(93, 88)
	),
	scenario(
		'long-content',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture(
			'long-content',
			{
				title: 'The Generations of Discovery and Community Partnership Donor Directory',
				subtitle:
					'With lasting gratitude for every person and family helping imagination, learning, and belonging flourish',
				entryField3Column: 'Recognition',
				numberLocale: 'de-DE',
				timeZone: 'Europe/Madrid',
				showCategoryButtonDescriptions: true
			},
			{
				donorData: nativeDonorValue(longRows),
				categoryData: nativeCategoryValue(longCategoryRows)
			}
		),
		{ interactionSteps: [{ type: 'click', role: 'button', name: 'Visionary Community Transformation Partners' }] },
		coverage(93, 88)
	),
	scenario(
		'maximum-content',
		{ width: 1920, height: 1080, background: 'dark' },
		makeFixture(
			'maximum-content',
			{
				directoryColumns: 4,
				entriesPerColumn: 12
			},
			{
				donorData: nativeDonorValue(makeDonorRows(500, maximumCategories)),
				categoryData: nativeCategoryValue(maximumCategoryRows)
			}
		),
		{},
		coverage(93, 88)
	),
	scenario(
		'uneven-last-page',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture(
			'uneven-last-page',
			{},
			{
				donorData: nativeDonorValue(makeDonorRows(25, ['Community Friends'])),
				categoryData: nativeCategoryValue(categoryRows)
			}
		),
		{ interactionSteps: [{ type: 'click', role: 'button', name: 'Next donor page' }] },
		coverage(93, 88)
	),
	scenario(
		'uneven-last-page-capped',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture(
			'uneven-last-page-capped',
			{ maximumRowHeight: 120 },
			{
				donorData: nativeDonorValue(makeDonorRows(25, ['Community Friends'])),
				categoryData: nativeCategoryValue(categoryRows)
			}
		),
		{ interactionSteps: [{ type: 'click', role: 'button', name: 'Next donor page' }] },
		coverage(93, 88)
	),
	scenario(
		'missing-logo',
		{ width: 1280, height: 720, background: 'light' },
		makeFixture('missing-logo', { logo: '' }),
		{},
		coverage(92, 88)
	),
	scenario(
		'row-array',
		{ width: 1280, height: 720, background: 'checker' },
		makeFixture(
			'row-array',
			{},
			{
				donorData: defaultDonorRows.map((row: PreviewRow): PreviewRow => ({ ...row })),
				categoryData: nativeCategoryValue()
			}
		),
		{},
		coverage(93, 88)
	),
	scenario(
		'live-donor-update',
		{ width: 1280, height: 720, background: 'light' },
		makeFixture(
			'live-donor-update',
			{ directoryColumns: 2, entriesPerColumn: 2 },
			{
				donorData: nativeDonorValue(makeDonorRows(15)),
				categoryData: nativeCategoryValue()
			}
		),
		{
			liveDatasourceUpdate: {
				property: 'donorData',
				value: nativeDonorValue(liveDonorRows),
				expectedText: 'Aero Bloom'
			}
		},
		coverage(93, 88)
	),
	scenario(
		'live-category-update',
		{ width: 1920, height: 1080, background: 'checker' },
		makeFixture('live-category-update'),
		{
			interactionSteps: [{ type: 'click', role: 'button', name: 'Founding Partners' }],
			liveDatasourceUpdate: {
				property: 'categoryData',
				value: nativeCategoryValue(liveCategoryRows),
				expectedText: 'Updated recognition description.'
			}
		},
		coverage(93, 88)
	)
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'format-number-columns-as-currency',
		property: 'formatNumberColumnsAsCurrency',
		changedValue: true,
		selector: '.wb-donor-directory-entry-field-2',
		scenario: 'three-field-entries',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'currency-symbol',
		property: 'currencySymbol',
		changedValue: '€',
		selector: '.wb-donor-directory-entry-field-2',
		scenario: 'currency-number-columns',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'entry-field-1-column',
		property: 'entryField1Column',
		changedValue: 'Recognition',
		selector: '.wb-donor-directory-entry-field-1',
		scenario: 'three-field-entries',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'entry-field-2-column',
		property: 'entryField2Column',
		changedValue: 'Recognition',
		selector: '.wb-donor-directory-entry-field-2',
		scenario: 'three-field-entries',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'entry-field-3-column',
		property: 'entryField3Column',
		changedValue: '',
		selector: '[data-preview-id="donor-entry"]',
		scenario: 'three-field-entries',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'sort-direction',
		property: 'sortDirection',
		changedValue: 'descending',
		selector: '.wb-donor-directory-entry-field-1',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'directory-columns',
		property: 'directoryColumns',
		changedValue: 4,
		selector: '[data-column-count]',
		measurement: { type: 'attribute', name: 'data-column-count' },
		expectation: { type: 'change' }
	},
	{
		id: 'entries-per-column',
		property: 'entriesPerColumn',
		changedValue: 20,
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: { type: 'attribute', name: 'data-effective-entries' },
		expectation: { type: 'change' }
	},
	{
		id: 'maximum-row-height',
		property: 'maximumRowHeight',
		changedValue: 60,
		selector: '[data-preview-id="donor-entry"]',
		scenario: 'uneven-last-page',
		measurement: { type: 'bounding-box', dimension: 'height' },
		expectation: { type: 'decrease', minimumDelta: 20 }
	},
	{
		id: 'title-copy',
		property: 'title',
		changedValue: 'A Grateful Community',
		selector: '.wb-donor-directory-title',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'title-font-size',
		property: 'titleFontSize',
		changedValue: 64,
		selector: '.wb-donor-directory-title',
		measurement: { type: 'computed-style', property: 'font-size' },
		expectation: { type: 'increase', minimumDelta: 8 }
	},
	{
		id: 'subtitle-copy',
		property: 'subtitle',
		changedValue: 'Thank you for making discovery possible',
		selector: '.wb-donor-directory-subtitle',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'all-label',
		property: 'allLabel',
		changedValue: 'Everyone',
		selector: '[data-category-key="__all_donors__"] .wb-donor-directory-category-label',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'all-label-font-size',
		property: 'allLabelFontSize',
		changedValue: 42,
		selector: '[data-preview-id="active-category"]',
		measurement: { type: 'computed-style', property: 'font-size' },
		expectation: { type: 'increase', minimumDelta: 8 }
	},
	{
		id: 'header-logo',
		property: 'logo',
		changedValue: alternateLogo,
		selector: '[data-preview-id="donor-logo-region"] img',
		measurement: { type: 'attribute', name: 'src' },
		expectation: { type: 'change' }
	},
	{
		id: 'logo-scale',
		property: 'logoScale',
		changedValue: 120,
		selector: '[data-preview-id="donor-logo-region"] img',
		measurement: { type: 'bounding-box', dimension: 'height' },
		expectation: { type: 'increase', minimumDelta: 10 }
	},
	{
		id: 'date-format',
		property: 'dateFormat',
		changedValue: 'none',
		selector: '[data-preview-id="header-meta"]',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'time-format',
		property: 'timeFormat',
		changedValue: 'none',
		selector: '[data-preview-id="header-meta"]',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'keyboard-availability',
		property: 'showKeyboard',
		changedValue: false,
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: { type: 'attribute', name: 'data-touch-keyboard-enabled' },
		expectation: { type: 'change' }
	},
	{
		id: 'show-category-button-descriptions',
		property: 'showCategoryButtonDescriptions',
		changedValue: true,
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: { type: 'attribute', name: 'data-show-category-button-descriptions' },
		expectation: { type: 'change' }
	},
	{
		id: 'autoplay-interval',
		property: 'autoplayIntervalSeconds',
		changedValue: 14,
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: { type: 'attribute', name: 'data-autoplay-interval' },
		expectation: { type: 'change' }
	},
	{
		id: 'motion-preset',
		property: 'motionPreset',
		changedValue: 'off',
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: { type: 'attribute', name: 'data-motion' },
		expectation: { type: 'change' }
	},
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'dark',
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: { type: 'attribute', name: 'data-theme' },
		expectation: { type: 'change' }
	},
	{
		id: 'display-font',
		property: 'displayFont',
		changedValue: font('Arial, Helvetica, sans-serif', '700'),
		selector: '.wb-donor-directory-title',
		measurement: { type: 'computed-style', property: 'font-family' },
		expectation: { type: 'change' }
	},
	{
		id: 'interface-font',
		property: 'interfaceFont',
		changedValue: font('Georgia, Times New Roman, serif', '500'),
		selector: 'input[type="search"]',
		measurement: { type: 'computed-style', property: 'font-family' },
		expectation: { type: 'change' }
	},
	{
		id: 'category-font',
		property: 'categoryFont',
		changedValue: font('Georgia, Times New Roman, serif', '600'),
		selector: '.wb-donor-directory-category-label',
		measurement: { type: 'computed-style', property: 'font-family' },
		expectation: { type: 'change' }
	},
	{
		id: 'category-max-font-size',
		property: 'categoryMaxFontSize',
		changedValue: 28,
		selector: '.wb-donor-directory-category-label',
		measurement: { type: 'computed-style', property: 'font-size' },
		expectation: { type: 'increase', minimumDelta: 2 }
	},
	{
		id: 'category-button-description-font',
		property: 'categoryButtonDescriptionFont',
		changedValue: font('Georgia, Times New Roman, serif', '600'),
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: {
			type: 'computed-style',
			property: '--wb-donor-directory-category-button-description-font'
		},
		expectation: { type: 'change' }
	},
	{
		id: 'category-button-description-max-font-size',
		property: 'categoryButtonDescriptionMaxFontSize',
		changedValue: 20,
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: {
			type: 'computed-style',
			property: '--wb-donor-directory-category-button-description-size'
		},
		expectation: { type: 'increase', minimumDelta: 6 }
	},
	{
		id: 'active-category-description-font',
		property: 'activeCategoryDescriptionFont',
		changedValue: font('Georgia, Times New Roman, serif', '600'),
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: {
			type: 'computed-style',
			property: '--wb-donor-directory-active-category-description-font'
		},
		expectation: { type: 'change' }
	},
	{
		id: 'active-category-description-max-font-size',
		property: 'activeCategoryDescriptionMaxFontSize',
		changedValue: 22,
		selector: '[data-preview-id="donor-directory-root"]',
		measurement: {
			type: 'computed-style',
			property: '--wb-donor-directory-active-category-description-size'
		},
		expectation: { type: 'increase', minimumDelta: 6 }
	},
	{
		id: 'entry-field-1-font',
		property: 'entryField1Font',
		changedValue: font('Arial, Helvetica, sans-serif', '700'),
		selector: '.wb-donor-directory-entry-field-1',
		measurement: { type: 'computed-style', property: 'font-family' },
		expectation: { type: 'change' }
	},
	{
		id: 'entry-field-1-max-font-size',
		property: 'entryField1MaxFontSize',
		changedValue: 40,
		selector: '.wb-donor-directory-entry-field-1',
		measurement: { type: 'computed-style', property: 'font-size' },
		expectation: { type: 'increase', minimumDelta: 2 }
	},
	{
		id: 'entry-field-2-font',
		property: 'entryField2Font',
		changedValue: font('Georgia, Times New Roman, serif', '600'),
		selector: '.wb-donor-directory-entry-field-2',
		measurement: { type: 'computed-style', property: 'font-family' },
		expectation: { type: 'change' }
	},
	{
		id: 'entry-field-2-max-font-size',
		property: 'entryField2MaxFontSize',
		changedValue: 28,
		selector: '.wb-donor-directory-entry-field-2',
		measurement: { type: 'computed-style', property: 'font-size' },
		expectation: { type: 'increase', minimumDelta: 2 }
	},
	{
		id: 'entry-field-3-font',
		property: 'entryField3Font',
		changedValue: font('Georgia, Times New Roman, serif', '500'),
		selector: '.wb-donor-directory-entry-field-3',
		scenario: 'three-field-entries',
		measurement: { type: 'computed-style', property: 'font-family' },
		expectation: { type: 'change' }
	},
	{
		id: 'entry-field-3-max-font-size',
		property: 'entryField3MaxFontSize',
		changedValue: 24,
		selector: '.wb-donor-directory-entry-field-3',
		scenario: 'three-field-entries',
		measurement: { type: 'computed-style', property: 'font-size' },
		expectation: { type: 'increase', minimumDelta: 2 }
	},
	{
		id: 'corner-radius',
		property: 'cornerRadius',
		changedValue: 28,
		selector: '[data-preview-id="donor-directory-frame"]',
		measurement: { type: 'computed-style', property: 'border-radius' },
		expectation: { type: 'change' }
	},
	{
		id: 'background-image',
		property: 'backgroundImage',
		changedValue: alternateBackground,
		selector: '[data-preview-id="donor-directory-root"]',
		scenario: 'custom-theme',
		measurement: { type: 'computed-style', property: '--wb-donor-directory-background-image' },
		expectation: { type: 'change' }
	},
	{
		id: 'background-overlay-color',
		property: 'backgroundOverlayColor',
		changedValue: '#6a315a',
		selector: '[data-preview-id="donor-directory-root"]',
		scenario: 'custom-theme',
		measurement: { type: 'computed-style', property: '--wb-donor-directory-background-overlay' },
		expectation: { type: 'change' }
	},
	{
		id: 'background-overlay-opacity',
		property: 'backgroundOverlayOpacity',
		changedValue: 46,
		selector: '[data-preview-id="donor-directory-root"]',
		scenario: 'custom-theme',
		measurement: { type: 'computed-style', property: '--wb-donor-directory-background-overlay-opacity' },
		expectation: { type: 'increase', minimumDelta: 0.2 }
	},
	...[
		['background-color', 'backgroundColor', '#e5d9f2', '--wb-donor-directory-background'],
		['header-background-color', 'headerBackgroundColor', '#33205b', '--wb-donor-directory-header-background'],
		['header-text-color', 'headerTextColor', '#fff2b5', '--wb-donor-directory-header-text'],
		['panel-color', 'panelColor', '#f4efff', '--wb-donor-directory-panel'],
		['primary-text-color', 'primaryTextColor', '#28164f', '--wb-donor-directory-primary-text'],
		['secondary-text-color', 'secondaryTextColor', '#76589d', '--wb-donor-directory-secondary-text'],
		[
			'category-button-description-text-color',
			'categoryButtonDescriptionTextColor',
			'#5b247a',
			'--wb-donor-directory-category-button-description-text'
		],
		[
			'active-category-description-text-color',
			'activeCategoryDescriptionTextColor',
			'#7a281f',
			'--wb-donor-directory-active-category-description-text'
		],
		['entry-field-1-text-color', 'entryField1TextColor', '#26134f', '--wb-donor-directory-entry-field-1-text'],
		['entry-field-2-text-color', 'entryField2TextColor', '#843d0f', '--wb-donor-directory-entry-field-2-text'],
		['entry-field-3-text-color', 'entryField3TextColor', '#6a427d', '--wb-donor-directory-entry-field-3-text'],
		['category-button-color', 'categoryButtonColor', '#d8c8ee', '--wb-donor-directory-category-button'],
		['category-button-text-color', 'categoryButtonTextColor', '#32185d', '--wb-donor-directory-category-button-text'],
		['category-active-color', 'categoryActiveColor', '#563097', '--wb-donor-directory-category-active'],
		['category-active-text-color', 'categoryActiveTextColor', '#fff4c7', '--wb-donor-directory-category-active-text'],
		['donor-card-color', 'donorCardColor', '#fff8df', '--wb-donor-directory-card'],
		['donor-card-border-color', 'donorCardBorderColor', '#6f4e9f', '--wb-donor-directory-card-border'],
		['search-background-color', 'searchBackgroundColor', '#fff5dd', '--wb-donor-directory-search-background'],
		['search-text-color', 'searchTextColor', '#3c1968', '--wb-donor-directory-search-text'],
		['search-border-color', 'searchBorderColor', '#7f5aa7', '--wb-donor-directory-search-border'],
		['accent-color', 'accentColor', '#9b4d12', '--wb-donor-directory-accent'],
		['accent-text-color', 'accentTextColor', '#fff7d6', '--wb-donor-directory-accent-text'],
		['keyboard-background-color', 'keyboardBackgroundColor', '#efe5fb', '--wb-donor-directory-keyboard-background'],
		['keyboard-key-color', 'keyboardKeyColor', '#d4c0ed', '--wb-donor-directory-keyboard-key'],
		['keyboard-key-text-color', 'keyboardKeyTextColor', '#3c1968', '--wb-donor-directory-keyboard-text']
	].map(([id, property, changedValue, cssVariable]: string[]): PreviewSettingEffect => ({
		id,
		property,
		changedValue,
		selector: '[data-preview-id="donor-directory-root"]',
		scenario: 'custom-theme',
		measurement: { type: 'computed-style', property: cssVariable },
		expectation: { type: 'change' }
	}))
];

const previewFixture: PreviewFixture = makeFixture('default');

export default previewFixture;
