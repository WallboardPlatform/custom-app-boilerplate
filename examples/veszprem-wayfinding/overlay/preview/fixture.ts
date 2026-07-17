import sampleDestinationData from '../sample-destinations-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface PreviewDestinationRow extends Record<string, unknown> {
	id: string;
	name: string;
	englishName: string;
	category: string;
	description: string;
	accessible: boolean;
	routeable: boolean;
}

interface PreviewDestinationDatasource {
	Destinations: {
		header: Record<string, string>;
		rows: PreviewDestinationRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource: PreviewDestinationDatasource = sampleDestinationData as PreviewDestinationDatasource;
const baseConfig: Record<string, unknown> = {
	title: 'Veszprem Downtown Wayfinding',
	subtitle: 'Choose a destination to draw a walking route from Heroes\' Gate.',
	startLocationId: 'hosok-kapuja',
	emptyStateText: 'No destinations are available.',
	routeResetSeconds: 45,
	wayfindingSensitivity: 50,
	mapRatio: 1,
	themePreset: 'light',
	backgroundColor: '#ead9c8',
	panelColor: '#fff9ef',
	primaryTextColor: '#17312f',
	secondaryTextColor: '#5d716d',
	accentColor: '#d08b2e',
	routeColor: '#cf332b'
};

const withRows = (rows: PreviewDestinationRow[]): PreviewDestinationDatasource => ({
	Destinations: {
		...sampleDatasource.Destinations,
		rows
	}
});

const createFixture = (
	id: string,
	data: unknown = sampleDatasource,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '[data-preview-id="veszprem-wayfinding-root"]',
	settleMs: 1100,
	configValues,
	dataPickerValues: { destinationData: data },
	datasourceIds: { destinationData: 'preview-veszprem-destinations' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const longRows: PreviewDestinationRow[] = sampleDatasource.Destinations.rows.map(
	(row: PreviewDestinationRow, index: number): PreviewDestinationRow => index === 0 ? {
		...row,
		name: 'Hősök Kapuja és a Várnegyed Látogatóközpont hosszú tájékozódási pontja',
		englishName: 'Heroes\' Gate and Castle District Visitor Orientation Centre'
	} : row
);

const previewFixture: PreviewFixture = {
	id: 'veszprem-wayfinding-unbound',
	readySelector: '[data-preview-id="veszprem-wayfinding-root"]',
	settleMs: 650,
	configValues: baseConfig,
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
};

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'app-default',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'compact',
		fixture: createFixture('veszprem-wayfinding-compact', sampleDatasource, { ...baseConfig, themePreset: 'dark' }),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'active-route',
		fixture: createFixture('veszprem-wayfinding-active-route'),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Hangvilla Multifunkcionális Közösségi Tér' }],
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'external-destination',
		fixture: createFixture('veszprem-wayfinding-external'),
		viewport: { width: 1366, height: 768, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Veszprém Aréna Sport- és Rendezvénycsarnok' }],
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'custom-theme',
		fixture: createFixture('veszprem-wayfinding-custom', sampleDatasource, {
			...baseConfig,
			themePreset: 'custom',
			backgroundColor: '#dfe7e2',
			panelColor: '#f7fbf8',
			primaryTextColor: '#142a27',
			secondaryTextColor: '#536b66',
			accentColor: '#007a68',
			routeColor: '#c53d32'
		}),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'long-title',
		fixture: createFixture('veszprem-wayfinding-long-title', sampleDatasource, {
			...baseConfig,
			title: 'Veszprem Historic Downtown Visitor Orientation and Walking Wayfinding'
		}),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'long-destination-list',
		fixture: createFixture('veszprem-wayfinding-long-destination-list', withRows(longRows)),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'long-destination-selected',
		fixture: createFixture('veszprem-wayfinding-long-destination', withRows(longRows)),
		viewport: { width: 1366, height: 768, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Hősök Kapuja és a Várnegyed' }],
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'empty',
		fixture: createFixture('veszprem-wayfinding-empty', withRows([])),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'row-array',
		fixture: createFixture('veszprem-wayfinding-row-array', sampleDatasource.Destinations.rows),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('veszprem-wayfinding-live-update'),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 96, height: 94 },
		liveDatasourceUpdate: {
			property: 'destinationData',
			value: withRows([{ ...sampleDatasource.Destinations.rows[0], name: 'Updated Visitor Gateway', englishName: 'Updated gateway English label' }]),
			expectedText: 'Updated gateway English label'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'dark',
		selector: '[data-preview-id="veszprem-wayfinding-root"]',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'route-reset',
		property: 'routeResetSeconds',
		changedValue: 90,
		selector: '[data-preview-id="veszprem-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-route-reset' },
		expectation: { type: 'change' }
	},
	{
		id: 'route-sensitivity',
		property: 'wayfindingSensitivity',
		changedValue: 60,
		selector: '[data-preview-id="veszprem-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-route-sensitivity' },
		expectation: { type: 'change' }
	},
	{
		id: 'map-ratio',
		property: 'mapRatio',
		changedValue: 2,
		selector: '[data-preview-id="veszprem-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-map-ratio' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
