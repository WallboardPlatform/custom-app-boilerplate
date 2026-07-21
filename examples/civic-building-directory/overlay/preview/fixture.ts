import sampleDestinationData from '../sample-destinations-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface PreviewDestinationRow extends Record<string, unknown> {
	accessible?: boolean | null;
	alternateName: string;
	category: string;
	description: string;
	floor: string;
	hours: string;
	id: string;
	keywords: string;
	mapLabel: string;
	name: string;
	status: string;
}

interface PreviewDestinationDatasource {
	Destinations: {
		connectors: Record<string, unknown>;
		header: Record<string, string>;
		rows: PreviewDestinationRow[];
	};
}

const sampleDatasource: PreviewDestinationDatasource = sampleDestinationData as PreviewDestinationDatasource;
const baseConfig: Record<string, unknown> = {
	title: 'Civic Building Directory',
	subtitle: 'Find departments and public services across three levels.',
	guidanceMode: 'route',
	initialFloor: '1',
	startLocationId: 'main-lobby',
	emptyStateText: 'No destinations are available.',
	interfaceLanguages: 'en-es',
	keyboardLanguages: 'en-es',
	onScreenKeyboard: true,
	selectionResetSeconds: 60,
	motionPreset: 'subtle',
	themePreset: 'light',
	backgroundColor: '#e7e0d4',
	panelColor: '#fffdf8',
	mapSurfaceColor: '#f5f0e7',
	primaryTextColor: '#173039',
	secondaryTextColor: '#5b6e72',
	accentColor: '#b96734',
	destinationColor: '#217f79',
	routeColor: '#c83f32'
};

const withRows = (rows: PreviewDestinationRow[]): PreviewDestinationDatasource => ({
	Destinations: { ...sampleDatasource.Destinations, rows }
});

const rowById = (id: string): PreviewDestinationRow => {
	const row: PreviewDestinationRow | undefined = sampleDatasource.Destinations.rows.find((candidate: PreviewDestinationRow): boolean => candidate.id === id);
	if (!row) throw new Error(`Missing preview destination '${id}'.`);
	return row;
};

const createFixture = (
	id: string,
	data: unknown = sampleDatasource,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '[data-preview-id="civic-building-directory-root"]',
	settleMs: 950,
	configValues,
	dataPickerValues: { destinationData: data },
	datasourceIds: { destinationData: 'preview-civic-destinations' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const longRows: PreviewDestinationRow[] = sampleDatasource.Destinations.rows.map(
	(row: PreviewDestinationRow): PreviewDestinationRow => row.id === 'planning-development' ? {
		...row,
		name: 'Planning, Community Development, Permit Assistance, and Long-Range Services',
		alternateName: 'Planificación, desarrollo comunitario y asistencia con permisos'
	} : row
);

const unboundFixture: PreviewFixture = {
	id: 'civic-building-directory-unbound',
	readySelector: '[data-preview-id="civic-building-directory-root"]',
	settleMs: 950,
	configValues: baseConfig,
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
};

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'app-default',
		fixture: unboundFixture,
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'compact',
		fixture: createFixture('civic-compact', sampleDatasource, { ...baseConfig, themePreset: 'dark' }),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'level-two',
		fixture: createFixture('civic-level-two', sampleDatasource, { ...baseConfig, initialFloor: '2' }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'level-three',
		fixture: createFixture('civic-level-three', sampleDatasource, { ...baseConfig, initialFloor: '3' }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'cross-floor-selection',
		fixture: createFixture('civic-cross-floor'),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Council Office' }],
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'cross-floor-destination-level',
		fixture: createFixture('civic-cross-floor-destination-level'),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [
			{ type: 'click', role: 'button', name: 'Council Office' },
			{ type: 'click', role: 'button', name: 'View Level 3' }
		],
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'active-highlight',
		fixture: createFixture('civic-active-highlight', sampleDatasource, { ...baseConfig, guidanceMode: 'highlight' }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Utility Billing' }],
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'same-floor-route',
		fixture: createFixture('civic-same-floor-route'),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Utility Billing' }],
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'zoomed-route',
		fixture: createFixture('civic-zoomed-route'),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [
			{ type: 'click', role: 'button', name: 'Zoom in' },
			{ type: 'click', role: 'button', name: 'Zoom in' },
			{ type: 'click', role: 'button', name: 'Utility Billing' }
		],
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'keyboard-open',
		fixture: createFixture('civic-keyboard'),
		viewport: { width: 1366, height: 768, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Open touch keyboard' }],
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'custom-theme',
		fixture: createFixture('civic-custom-theme', sampleDatasource, {
			...baseConfig,
			themePreset: 'custom',
			backgroundColor: '#d7e0dc',
			panelColor: '#f8fbf9',
			mapSurfaceColor: '#e8efec',
			primaryTextColor: '#142c2a',
			secondaryTextColor: '#4e6864',
			accentColor: '#7b3fa1',
			destinationColor: '#bf3d62',
			routeColor: '#c43f35'
		}),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'long-title',
		fixture: createFixture('civic-long-title', sampleDatasource, {
			...baseConfig,
			title: 'Northline Civic Administration and Public Services Building Directory'
		}),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'long-destination-list',
		fixture: createFixture('civic-long-list', withRows(longRows)),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'long-destination-selected',
		fixture: createFixture('civic-long-selected', withRows(longRows)),
		viewport: { width: 1366, height: 768, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Planning, Community Development' }],
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'empty',
		fixture: createFixture('civic-empty', withRows([])),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'row-array',
		fixture: createFixture('civic-row-array', sampleDatasource.Destinations.rows),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('civic-live-update'),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 },
		liveDatasourceUpdate: {
			property: 'destinationData',
			value: withRows([{ ...rowById('main-lobby'), name: 'Updated Visitor Welcome Center' }]),
			expectedText: 'Updated Visitor Welcome Center'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'guidance-mode', property: 'guidanceMode', changedValue: 'highlight',
		selector: '[data-preview-id="civic-building-directory-root"]',
		measurement: { type: 'attribute', name: 'data-guidance-mode' }, expectation: { type: 'change' }
	},
	{
		id: 'theme-preset', property: 'themePreset', changedValue: 'dark',
		selector: '[data-preview-id="civic-building-directory-root"]',
		measurement: { type: 'computed-style', property: 'background-color' }, expectation: { type: 'change' }
	},
	{
		id: 'selection-reset', property: 'selectionResetSeconds', changedValue: 120,
		selector: '[data-preview-id="civic-building-directory-root"]',
		measurement: { type: 'attribute', name: 'data-selection-reset' }, expectation: { type: 'change' }
	},
	{
		id: 'motion-preset', property: 'motionPreset', changedValue: 'off',
		selector: '[data-preview-id="civic-building-directory-root"]',
		measurement: { type: 'attribute', name: 'data-motion' }, expectation: { type: 'change' }
	},
	{
		id: 'initial-floor', property: 'initialFloor', changedValue: '2',
		selector: '[data-preview-id="civic-building-directory-root"]',
		measurement: { type: 'attribute', name: 'data-active-floor' }, expectation: { type: 'change' }
	}
];

export default unboundFixture;
