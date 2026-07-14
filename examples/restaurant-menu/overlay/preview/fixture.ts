import sampleDatasourceJson from '../sample-datasource.json';

export interface PreviewFixture {
	id: string;
	readySelector?: string;
	configValues: Record<string, unknown>;
	dataPickerValues: Record<string, unknown>;
	datasourceIds: Record<string, string | number | undefined>;
	additionalConfig?: Record<string, unknown>;
}

export interface PreviewScenario {
	id: string;
	fixture: PreviewFixture;
	viewport: {
		width: number;
		height: number;
		background?: 'checker' | 'light' | 'dark';
	};
	advanceTimeMs?: number;
	minimumContentCoverage?: {
		width: number;
		height: number;
	};
	liveDatasourceUpdate?: {
		property: string;
		value: unknown;
		expectedText: string;
	};
}

interface MenuRow extends Record<string, unknown> {
	section: string;
	sectionOrder: number;
	itemOrder: number;
	name: string;
	description: string;
	price: string;
	badge: string;
	available: boolean;
	featured: boolean;
}

interface MenuDatasource {
	MenuItems: {
		header: Record<string, string>;
		rows: MenuRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource: MenuDatasource = sampleDatasourceJson as MenuDatasource;
const baseConfig: Record<string, unknown> = {
	restaurantLabel: 'Restaurant',
	restaurantName: 'Cordo',
	editionTitle: 'Dinner menu',
	editionSubtitle: 'Seasonal kitchen - thoughtfully sourced',
	storyEyebrow: "Chef's selection",
	storyTitle: 'Simple ingredients.\nConsidered plates.',
	storyDescription: 'Our evening menu follows the market, the season, and the growers we trust.',
	courseLabel: "Tonight's table",
	courseName: 'Four courses',
	coursePrice: '$68',
	closingText: 'Kitchen closes 22:30',
	allergenText: 'Ask us about allergens',
	emptyStateText: 'No menu items are available.',
	pageDurationSeconds: 3
};

const withRows = (rows: MenuRow[]): MenuDatasource => ({
	MenuItems: {
		...sampleDatasource.MenuItems,
		rows
	}
});

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.menu-header h1',
	configValues,
	dataPickerValues: { menuData: data },
	datasourceIds: { menuData: 'preview-menu-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('cordo-menu-board-preview', sampleDatasource);

const longLabelRows: MenuRow[] = sampleDatasource.MenuItems.rows.map((row: MenuRow, index: number): MenuRow => {
	if (index !== 4) {
		return row;
	}

	return {
		...row,
		section: 'Seasonal mains from local farms and coastal producers',
		name: 'Slow glazed heritage pork shoulder with orchard mustard',
		description: 'caramelized apple, smoked cabbage, mustard seed jus, garden herbs',
		badge: 'Limited evening selection'
	};
});

const paginatedRows: MenuRow[] = [
	...sampleDatasource.MenuItems.rows,
	{ section: 'Mains', sectionOrder: 2, itemOrder: 4, name: 'Roast chicken', description: 'leek, jus, potato', price: '$24', badge: '', available: true, featured: false },
	{ section: 'Mains', sectionOrder: 2, itemOrder: 5, name: 'Grilled squash', description: 'seed pesto, herbs', price: '$20', badge: '', available: true, featured: false },
	{ section: 'Mains', sectionOrder: 2, itemOrder: 6, name: 'Braised beef', description: 'onion, red wine', price: '$29', badge: '', available: true, featured: false },
	{ section: 'Mains', sectionOrder: 2, itemOrder: 7, name: 'Market fish', description: 'seasonal garnish', price: 'Market price', badge: '', available: true, featured: true },
	{ section: 'After dinner', sectionOrder: 5, itemOrder: 1, name: 'Espresso', description: 'single origin', price: '$4', badge: '', available: true, featured: false },
	{ section: 'After dinner', sectionOrder: 5, itemOrder: 2, name: 'Herbal tea', description: 'mint or chamomile', price: '$5', badge: '', available: true, featured: false }
];

const quickEditRows: MenuRow[] = sampleDatasource.MenuItems.rows.map(
	(row: MenuRow, index: number): MenuRow => index === 0
		? { ...row, name: 'Fire-roasted pepper soup', price: '$11' }
		: row
);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'static-unbound',
		fixture: {
			id: 'cordo-menu-static',
			configValues: baseConfig,
			dataPickerValues: {},
			datasourceIds: {},
			additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
		},
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 80, height: 75 }
	},
	{
		id: 'empty',
		fixture: createFixture('cordo-menu-empty', withRows([])),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 75, height: 70 }
	},
	{
		id: 'bound-null',
		fixture: createFixture('cordo-menu-bound-null', null),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 75, height: 70 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('cordo-menu-long-labels', withRows(longLabelRows)),
		viewport: { width: 1536, height: 432, background: 'dark' },
		minimumContentCoverage: { width: 80, height: 75 }
	},
	{
		id: 'row-array',
		fixture: createFixture('cordo-menu-row-array', sampleDatasource.MenuItems.rows),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 75, height: 70 }
	},
	{
		id: 'last-page',
		fixture: createFixture('cordo-menu-last-page', withRows(paginatedRows)),
		viewport: { width: 1366, height: 768, background: 'dark' },
		advanceTimeMs: 3500,
		minimumContentCoverage: { width: 80, height: 75 }
	},
	{
		id: 'quick-edit-update',
		fixture: createFixture('cordo-menu-quick-edit', sampleDatasource),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 80, height: 75 },
		liveDatasourceUpdate: {
			property: 'menuData',
			value: withRows(quickEditRows),
			expectedText: 'Fire-roasted pepper soup'
		}
	}
];

export default previewFixture;
