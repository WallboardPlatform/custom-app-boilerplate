import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface OfficeRow extends Record<string, unknown> {
	closesAtHour: number;
	name: string;
	opensAtHour: number;
	region: string;
	timeZone: string;
}

interface OfficesDatasource {
	Offices: {
		header: Record<string, string>;
		rows: OfficeRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource = sampleDatasourceJson as OfficesDatasource;
const rows: OfficeRow[] = sampleDatasource.Offices.rows;

const baseConfig: Record<string, unknown> = {
	boardTitle: 'Global offices',
	timeFormat: '24',
	showSeconds: false,
	showOpenState: true,
	emptyStateText: 'No offices are configured yet.',
	themePreset: 'light'
};

const withRows = (next: OfficeRow[]): OfficesDatasource => ({
	Offices: { ...sampleDatasource.Offices, rows: next }
});

const createFixture = (
	id: string,
	next: OfficeRow[],
	configOverrides: Record<string, unknown> = {}
): PreviewFixture => ({
	id,
	readySelector: '[data-preview-id="global-office-clock-root"]',
	configValues: { ...baseConfig, ...configOverrides },
	dataPickerValues: { officeData: withRows(next) },
	datasourceIds: { officeData: 'preview-offices-table' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

/** Every office outside its local working window, so the closed treatment is reviewable. */
const closedRows: OfficeRow[] = rows.map((row): OfficeRow => ({ ...row, opensAtHour: 3, closesAtHour: 4 }));
const longRows: OfficeRow[] = rows.map((row, index): OfficeRow => index === 0
	? { ...row, name: 'Riverbend Studio and Northern Fabrication Annexe', region: 'Hungary / Central Europe' }
	: row);
const sixRows: OfficeRow[] = [
	...rows,
	{ name: 'Copper Lane', region: 'Japan', timeZone: 'Asia/Tokyo', opensAtHour: 9, closesAtHour: 18 },
	{ name: 'Southbank Yard', region: 'Australia', timeZone: 'Australia/Sydney', opensAtHour: 8, closesAtHour: 17 }
];
const invalidRows: OfficeRow[] = rows.map((row, index): OfficeRow => index === 1
	? { ...row, timeZone: 'Nowhere/Imaginary' }
	: row);

const previewFixture: PreviewFixture = createFixture('global-office-clock-preview', rows);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'portrait',
		fixture: createFixture('global-office-clock-portrait', rows),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 86, height: 82 }
	},
	{
		id: 'compact',
		fixture: createFixture('global-office-clock-compact', rows),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 84, height: 74 }
	},
	{
		id: 'square',
		fixture: createFixture('global-office-clock-square', rows),
		viewport: { width: 768, height: 768, background: 'light' },
		minimumContentCoverage: { width: 84, height: 84 }
	},
	{
		id: 'dark-theme',
		fixture: createFixture('global-office-clock-dark', rows, { themePreset: 'dark' }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 88, height: 78 }
	},
	{
		id: 'two-offices',
		fixture: createFixture('global-office-clock-two', rows.slice(0, 2)),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 88, height: 78 }
	},
	{
		id: 'six-offices',
		fixture: createFixture('global-office-clock-six', sixRows),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 88, height: 78 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('global-office-clock-long', longRows),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 88, height: 78 }
	},
	{
		id: 'all-closed',
		fixture: createFixture('global-office-clock-closed', closedRows),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 88, height: 78 }
	},
	{
		id: 'invalid-timezone',
		fixture: createFixture('global-office-clock-invalid', invalidRows),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 88, height: 78 }
	},
	{
		id: 'empty',
		fixture: createFixture('global-office-clock-empty', []),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 40, height: 30 }
	}
];

export default previewFixture;

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'dark',
		selector: '[data-preview-id="global-office-clock-root"]',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'open-state-visibility',
		property: 'showOpenState',
		changedValue: false,
		selector: '.wb-global-office-clock-board',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	}
];
