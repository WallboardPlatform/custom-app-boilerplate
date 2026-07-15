import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

type UnitRecord = Record<string, unknown>;

interface UnitDatasource {
	data: Record<string, UnitRecord | null>;
	json_updated: string;
}

const sampleDatasource: UnitDatasource = sampleDatasourceJson as UnitDatasource;
const baseConfig: Record<string, unknown> = {
	titleText: 'Unit group pulse',
	subtitleText: 'Live call-center performance',
	emptyStateText: 'No unit metrics are currently available.',
	rotationSeconds: 3,
	excludedGroups: 'All BGE,TOTAL,Other',
	hideInactiveGroups: false,
	themePreset: 'light',
	fontFamily: "'Segoe UI', Arial, sans-serif",
	backgroundColor: '#eef2f5',
	surfaceColor: '#ffffff',
	primaryTextColor: '#142437',
	secondaryTextColor: '#657587',
	accentColor: '#2674c8',
	successColor: '#3d9b68',
	warningColor: '#d89118',
	dangerColor: '#cf4848'
};

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.unit-header h1',
	configValues,
	dataPickerValues: { groupData: data },
	datasourceIds: { groupData: 'preview-group-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const selectUnits = (names: string[]): UnitDatasource => ({
	data: names.reduce((result: Record<string, UnitRecord | null>, name: string): Record<string, UnitRecord | null> => {
		result[name] = sampleDatasource.data[name];
		return result;
	}, {}),
	json_updated: sampleDatasource.json_updated
});

const previewFixture: PreviewFixture = createFixture('call-center-unit-pulse-preview', sampleDatasource);
const longLabelData: UnitDatasource = {
	data: {
		'Customer Experience and Emergency Response Operations': {
			...sampleDatasource.data.EMR,
			business_unit: 'Customer Experience and Emergency Response Operations'
		}
	},
	json_updated: sampleDatasource.json_updated
};
const malformedData: UnitDatasource = {
	data: {
		broken: null,
		missing: { business_unit: '' },
		GAS: sampleDatasource.data.GAS
	},
	json_updated: sampleDatasource.json_updated
};
const liveUpdateData: UnitDatasource = {
	...selectUnits(['DSTATS']),
	data: {
		DSTATS: {
			...sampleDatasource.data.DSTATS,
			Calls_Waiting: 27,
			Oldest_Call_HMS: '0:03:12'
		}
	}
};

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'dark-theme',
		fixture: createFixture('unit-pulse-dark-theme', sampleDatasource, { ...baseConfig, themePreset: 'dark' }),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'excluded-aggregates',
		fixture: createFixture('unit-pulse-excluded', sampleDatasource),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'inactive-groups',
		fixture: createFixture('unit-pulse-inactive', selectUnits(['Scheduling'])),
		viewport: { width: 1280, height: 720, background: 'light' },
		minimumContentCoverage: { width: 88, height: 84 }
	},
	{
		id: 'empty',
		fixture: createFixture('unit-pulse-empty', { data: {}, json_updated: sampleDatasource.json_updated }),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 86, height: 55 }
	},
	{
		id: 'malformed-records',
		fixture: createFixture('unit-pulse-malformed', malformedData),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 86, height: 82 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('unit-pulse-long-labels', longLabelData),
		viewport: { width: 1536, height: 432, background: 'light' },
		minimumContentCoverage: { width: 92, height: 82 }
	},
	{
		id: 'rotation',
		fixture: createFixture('unit-pulse-rotation', selectUnits(['DSTATS', 'EMR', 'GAS'])),
		viewport: { width: 1366, height: 768, background: 'light' },
		advanceTimeMs: 3500,
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('unit-pulse-live-update', selectUnits(['DSTATS'])),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 90, height: 86 },
		liveDatasourceUpdate: {
			property: 'groupData',
			value: liveUpdateData,
			expectedText: '27'
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
