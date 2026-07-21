import sampleDestinationData from '../sample-destinations-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface PreviewDestinationRow extends Record<string, unknown> {
	accessible?: boolean | null;
	category: string;
	description: string;
	englishName: string;
	hours: string;
	id: string;
	mapNumber: string;
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
	title: 'Veszprem Downtown Wayfinding',
	subtitle: 'Select a landmark or use the search.',
	guidanceMode: 'highlight',
	startLocationId: 'tourinform-veszprem',
	emptyStateText: 'No destinations are available.',
	interfaceLanguages: 'en-hu',
	keyboardLanguages: 'hu-en',
	onScreenKeyboard: true,
	orientationConfirmed: false,
	routeResetSeconds: 45,
	mapNorthOffsetDegrees: 0,
	viewerFacingDegrees: 0,
	motionPreset: 'subtle',
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

const rowsById = (...ids: string[]): PreviewDestinationRow[] => ids.map((id: string): PreviewDestinationRow => {
	const row: PreviewDestinationRow | undefined = sampleDatasource.Destinations.rows.find((candidate: PreviewDestinationRow): boolean => candidate.id === id);

	if (!row) throw new Error(`Missing Veszprem preview destination '${id}'.`);

	return row;
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
	(row: PreviewDestinationRow, index: number): PreviewDestinationRow => index === 1 ? {
		...row,
		name: 'Hősök Kapuja és a Várnegyed Látogatóközpont hosszú tájékozódási pontja',
		englishName: 'Heroes\' Gate and Castle District Visitor Orientation Centre'
	} : row
);

const previewFixture: PreviewFixture = {
	id: 'veszprem-wayfinding-unbound',
	readySelector: '[data-preview-id="veszprem-wayfinding-root"]',
	settleMs: 1100,
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
		id: 'active-highlight',
		fixture: createFixture('veszprem-wayfinding-active-highlight', withRows(rowsById('tourinform-veszprem', 'laczko-dezso-muzeum'))),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Laczkó Dezső Múzeum' }],
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'directional-guidance',
		fixture: createFixture('veszprem-wayfinding-directional', withRows(rowsById('tourinform-veszprem', 'hosok-kapuja')), { ...baseConfig, guidanceMode: 'directional', orientationConfirmed: true, viewerFacingDegrees: 35 }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Hősök Kapuja' }],
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'keyboard-open',
		fixture: createFixture('veszprem-wayfinding-keyboard'),
		viewport: { width: 1366, height: 768, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Open touch keyboard' }],
		minimumContentCoverage: { width: 96, height: 94 }
	},
	{
		id: 'external-destination',
		fixture: createFixture('veszprem-wayfinding-external', withRows([
			...rowsById('tourinform-veszprem'),
			{ ...sampleDatasource.Destinations.rows[1], id: 'future-visitor-centre', mapNumber: 'INFO', name: 'Future Visitor Centre', englishName: 'Future Visitor Centre' }
		])),
		viewport: { width: 1366, height: 768, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Future Visitor Centre' }],
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
			value: withRows([{ ...sampleDatasource.Destinations.rows[1], name: 'Frissített Modern Képtár', englishName: 'Updated Modern Gallery' }]),
			expectedText: 'Updated Modern Gallery'
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
		id: 'motion-preset',
		property: 'motionPreset',
		changedValue: 'off',
		selector: '[data-preview-id="veszprem-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-motion' },
		expectation: { type: 'change' }
	},
	{
		id: 'guidance-mode',
		property: 'guidanceMode',
		changedValue: 'directory',
		selector: '[data-preview-id="veszprem-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-guidance-mode' },
		expectation: { type: 'change' }
	},
	{
		id: 'orientation-confirmation',
		property: 'orientationConfirmed',
		changedValue: true,
		selector: '[data-preview-id="veszprem-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-orientation-confirmed' },
		expectation: { type: 'change' }
	},
	{
		id: 'map-orientation',
		property: 'mapNorthOffsetDegrees',
		changedValue: 45,
		selector: '[data-preview-id="veszprem-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-map-north' },
		expectation: { type: 'change' }
	},
	{
		id: 'viewer-facing',
		property: 'viewerFacingDegrees',
		changedValue: 90,
		selector: '[data-preview-id="veszprem-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-viewer-facing' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
