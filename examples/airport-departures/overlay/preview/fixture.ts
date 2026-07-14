import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';


interface PreviewDepartureRow extends Record<string, unknown> {
	sortOrder: number;
	scheduledTime: string;
	destination: string;
	flight: string;
	airline: string;
	terminal: string;
	gate: string;
	status: string;
	statusTone: string;
	visible: boolean;
}

interface PreviewDepartureDatasource {
	Departures: {
		header: Record<string, string>;
		rows: PreviewDepartureRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource: PreviewDepartureDatasource = sampleDatasourceJson as PreviewDepartureDatasource;
const baseConfig: Record<string, unknown> = {
	airportCode: 'BUD',
	airportName: 'Budapest Airport',
	boardTitle: 'Departures',
	terminalLabel: 'Terminal 2',
	informationLabel: 'Live flight information',
	emptyStateText: 'No departures are currently listed.',
	pageDurationSeconds: 3,
	backgroundColor: '#111315',
	textColor: '#f5f6f3',
	accentColor: '#f4c542'
};

const withRows = (rows: PreviewDepartureRow[]): PreviewDepartureDatasource => ({
	Departures: {
		...sampleDatasource.Departures,
		rows
	}
});

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.departures-header h1',
	configValues,
	dataPickerValues: { departuresData: data },
	datasourceIds: { departuresData: 'preview-departures-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('airport-departures-preview', sampleDatasource);

const longLabelRows: PreviewDepartureRow[] = sampleDatasource.Departures.rows
	.slice(0, 4)
	.map((row: PreviewDepartureRow, index: number): PreviewDepartureRow => {
		if (index !== 1) {
			return row;
		}

		return {
			...row,
			destination: 'Santa Cruz de Tenerife South International',
			airline: 'Representative International Airways and Regional Partners',
			status: 'BOARDING AT GATE B7 - DOCUMENT CHECK',
			statusTone: 'boarding'
		};
	});

const oddCountRows: PreviewDepartureRow[] = [
	sampleDatasource.Departures.rows[0],
	sampleDatasource.Departures.rows[4],
	sampleDatasource.Departures.rows[9]
];

const maximumRows: PreviewDepartureRow[] = Array.from(
	{ length: 30 },
	(_: unknown, index: number): PreviewDepartureRow => {
		const template: PreviewDepartureRow = sampleDatasource.Departures.rows[index % sampleDatasource.Departures.rows.length];
		const hour: number = 9 + Math.floor(index / 4);
		const minute: number = (index % 4) * 15;

		return {
			...template,
			sortOrder: index + 1,
			scheduledTime: `${hour < 10 ? '0' : ''}${hour}:${minute === 0 ? '00' : minute}`,
			flight: `${template.flight.split(' ')[0]} ${1000 + index}`,
			gate: `${index % 2 === 0 ? 'A' : 'B'}${(index % 18) + 1}`
		};
	}
);

const lastPageRows: PreviewDepartureRow[] = maximumRows.slice(0, 16);
const invalidRows: PreviewDepartureRow[] = [
	...oddCountRows.slice(0, 1),
	{ ...sampleDatasource.Departures.rows[1], scheduledTime: '' },
	{ ...sampleDatasource.Departures.rows[2], destination: '' }
];
const liveUpdateRows: PreviewDepartureRow[] = sampleDatasource.Departures.rows.map(
	(row: PreviewDepartureRow, index: number): PreviewDepartureRow => index === 0
		? { ...row, gate: 'A18', status: 'BOARDING NOW', statusTone: 'boarding' }
		: row
);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'static-unbound',
		fixture: {
			id: 'airport-departures-static',
			configValues: baseConfig,
			dataPickerValues: {},
			datasourceIds: {},
			additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
		},
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 85 }
	},
	{
		id: 'empty',
		fixture: createFixture('airport-departures-empty', withRows([])),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 85, height: 80 }
	},
	{
		id: 'bound-null',
		fixture: createFixture('airport-departures-bound-null', null),
		viewport: { width: 600, height: 600, background: 'dark' },
		minimumContentCoverage: { width: 80, height: 80 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('airport-departures-long-labels', withRows(longLabelRows)),
		viewport: { width: 1536, height: 432, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 85 }
	},
	{
		id: 'odd-count',
		fixture: createFixture('airport-departures-odd-count', withRows(oddCountRows)),
		viewport: { width: 600, height: 600, background: 'dark' },
		minimumContentCoverage: { width: 80, height: 80 }
	},
	{
		id: 'invalid-rows',
		fixture: createFixture('airport-departures-invalid-rows', withRows(invalidRows)),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 85, height: 80 }
	},
	{
		id: 'row-array',
		fixture: createFixture('airport-departures-row-array', sampleDatasource.Departures.rows),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 85, height: 80 }
	},
	{
		id: 'maximum-content',
		fixture: createFixture('airport-departures-maximum', withRows(maximumRows)),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 85 }
	},
	{
		id: 'last-page',
		fixture: createFixture('airport-departures-last-page', withRows(lastPageRows)),
		viewport: { width: 1366, height: 768, background: 'dark' },
		advanceTimeMs: 6500,
		minimumContentCoverage: { width: 90, height: 85 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('airport-departures-live-update', sampleDatasource),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 85 },
		liveDatasourceUpdate: {
			property: 'departuresData',
			value: withRows(liveUpdateRows),
			expectedText: 'BOARDING NOW'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [];

export default previewFixture;
