import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

type PreviewQueueRow = Record<string, unknown>;

interface PreviewQueueDatasource {
	PharmacyQueue: {
		header: Record<string, string>;
		rows: PreviewQueueRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource: PreviewQueueDatasource = sampleDatasourceJson as PreviewQueueDatasource;
const baseConfig: Record<string, unknown> = {
	pharmacyName: 'Greenline Pharmacy',
	emptyStateText: 'No pickup tickets are waiting.',
	themePreset: 'light',
	backgroundColor: '#e9f1ed',
	heroBackgroundColor: '#07594b',
	surfaceColor: '#ffffff',
	primaryTextColor: '#17372f',
	secondaryTextColor: '#52675f',
	accentColor: '#8a5a00',
	alertColor: '#b34332'
};

const withRows = (rows: unknown[]): PreviewQueueDatasource => ({
	PharmacyQueue: {
		...sampleDatasource.PharmacyQueue,
		rows: rows as PreviewQueueRow[]
	}
});

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.pharmacy-brand__name',
	configValues,
	dataPickerValues: { queueData: data },
	datasourceIds: { queueData: 'synthetic-pharmacy-queue' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('greenline-pharmacy-preview', sampleDatasource);
const sampleRows: PreviewQueueRow[] = sampleDatasource.PharmacyQueue.rows;
const oneTicketRows: PreviewQueueRow[] = [sampleRows[0]];
const longLabelRows: PreviewQueueRow[] = [
	{
		ticket: 'RX-2026-ABCD-123456',
		counter: 'Consultation Counter - East Wing',
		state: 'called',
		note: 'Please have identification and insurance documents ready at the counter'
	},
	{
		ticket: 'PRESCRIPTION-2048-LONG',
		counter: 'Private Consultation Counter Seven',
		state: 'waiting',
		note: ''
	},
	{ ticket: 'B-205', counter: 'Counter 2', state: 'on hold', note: 'Pharmacist review' },
	{ ticket: 'C-206', counter: 'Counter 1', state: 'waiting', note: '' }
];
const longNextLabelRows: PreviewQueueRow[] = [
	{ ticket: 'A104', counter: 'Counter 2', state: 'called', note: 'Prescription ready' },
	{
		ticket: 'PRESCRIPTION-2048-LONG',
		counter: 'Private Consultation Counter Seven',
		state: 'waiting',
		note: ''
	},
	{ ticket: 'B-205', counter: 'Specialty Pickup Counter East', state: 'on hold', note: '' },
	{ ticket: 'C-206', counter: 'Counter 1', state: 'waiting', note: '' }
];
const manyWaitingRows: PreviewQueueRow[] = [
	{ ticket: 'A104', counter: 'Counter 2', state: 'called', note: 'Prescription ready' },
	{ ticket: 'A105', counter: 'Counter 1', state: 'waiting', note: '' },
	{ ticket: 'A106', counter: 'Counter 3', state: 'waiting', note: '' },
	{ ticket: 'A107', counter: 'Counter 2', state: 'on hold', note: 'Pharmacist review' },
	{ ticket: 'A108', counter: 'Counter 1', state: 'collected', note: '' },
	{ ticket: 'A109', counter: 'Counter 3', state: 'waiting', note: '' },
	{ ticket: 'A110', counter: 'Counter 2', state: 'pending', note: '' },
	{ ticket: 'A111', counter: 'Counter 1', state: 'waiting', note: '' },
	{ ticket: 'A112', counter: 'Counter 3', state: 'waiting', note: '' }
];
const unknownStateRows: PreviewQueueRow[] = [
	{ ticket: 'Q204', counter: 'Counter 4', state: 'insurance check', note: '' },
	{ ticket: 'Q205', counter: 'Counter 1', state: 'waiting', note: '' }
];
const invalidRows: unknown[] = [
	{ ticket: 'V301', counter: 'Counter 2', state: 'called', note: '' },
	{ ticket: '', counter: 'Counter 1', state: 'waiting', note: '' },
	{ counter: 'Counter 3', state: 'waiting', note: '' },
	null,
	'not a row'
];
const liveUpdateRows: PreviewQueueRow[] = [
	{ ticket: 'B214', counter: 'Counter 4', state: 'called', note: 'Prescription ready' },
	{ ticket: 'B215', counter: 'Counter 1', state: 'waiting', note: '' },
	{ ticket: 'B216', counter: 'Counter 2', state: 'waiting', note: '' }
];

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'dark-theme',
		fixture: createFixture('greenline-dark-theme', sampleDatasource, { ...baseConfig, themePreset: 'dark' }),
		viewport: { width: 480, height: 270, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 88 }
	},
	{
		id: 'static-unbound',
		fixture: {
			id: 'greenline-static-unbound',
			readySelector: '.pharmacy-brand__name',
			configValues: baseConfig,
			dataPickerValues: {},
			datasourceIds: {},
			additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
		},
		viewport: { width: 480, height: 270, background: 'checker' },
		minimumContentCoverage: { width: 90, height: 88 }
	},
	{
		id: 'empty',
		fixture: createFixture('greenline-empty', withRows([])),
		viewport: { width: 480, height: 270, background: 'light' },
		minimumContentCoverage: { width: 83, height: 64 }
	},
	{
		id: 'one-ticket',
		fixture: createFixture('greenline-one-ticket', withRows(oneTicketRows)),
		viewport: { width: 480, height: 270, background: 'checker' },
		minimumContentCoverage: { width: 86, height: 75 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('greenline-long-labels', withRows(longLabelRows), {
			...baseConfig,
			pharmacyName: 'Greenline Community Pharmacy and Wellness Center'
		}),
		viewport: { width: 480, height: 270, background: 'checker' },
		minimumContentCoverage: { width: 86, height: 65 }
	},
	{
		id: 'many-waiting',
		fixture: createFixture('greenline-many-waiting', withRows(manyWaitingRows)),
		viewport: { width: 480, height: 270, background: 'checker' },
		minimumContentCoverage: { width: 90, height: 88 }
	},
	{
		id: 'long-next-labels',
		fixture: createFixture('greenline-long-next-labels', withRows(longNextLabelRows)),
		viewport: { width: 480, height: 270, background: 'checker' },
		minimumContentCoverage: { width: 90, height: 83 }
	},
	{
		id: 'unknown-state',
		fixture: createFixture('greenline-unknown-state', withRows(unknownStateRows)),
		viewport: { width: 480, height: 270, background: 'checker' },
		minimumContentCoverage: { width: 90, height: 78 }
	},
	{
		id: 'invalid-rows',
		fixture: createFixture('greenline-invalid-rows', withRows(invalidRows)),
		viewport: { width: 480, height: 270, background: 'checker' },
		minimumContentCoverage: { width: 86, height: 75 }
	},
	{
		id: 'row-array',
		fixture: createFixture('greenline-row-array', sampleRows),
		viewport: { width: 480, height: 270, background: 'checker' },
		minimumContentCoverage: { width: 90, height: 88 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('greenline-live-update', sampleDatasource),
		viewport: { width: 480, height: 270, background: 'checker' },
		minimumContentCoverage: { width: 90, height: 78 },
		liveDatasourceUpdate: {
			property: 'queueData',
			value: withRows(liveUpdateRows),
			expectedText: 'B214'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'dark',
		selector: '.wb-app',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
