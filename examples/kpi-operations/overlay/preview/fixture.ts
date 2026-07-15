import operationsData from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';


const baseConfig: Record<string, unknown> = {
	titleText: 'Operations pulse',
	subtitleText: 'Live fulfillment performance',
	emptyStateText: 'No operational data is available.',
	targetLabel: 'Daily target',
	targetValue: 2400,
	themePreset: 'dark',
	fontFamily: "'Segoe UI', Arial, sans-serif",
	backgroundColor: '#101416',
	surfaceColor: '#1b2226',
	primaryTextColor: '#f4f1e8',
	secondaryTextColor: '#aab5ba',
	accentColor: '#63d7ff',
	positiveColor: '#63e6bd',
	warningColor: '#ffbf69'
};

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.wb-app__header h1',
	configValues,
	dataPickerValues: { operationsData: data },
	datasourceIds: { operationsData: 'preview-operations-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('kpi-operations-preview', operationsData);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'light-theme',
		fixture: createFixture('kpi-operations-light-theme', operationsData, { ...baseConfig, themePreset: 'light' }),
		viewport: { width: 1280, height: 720, background: 'light' },
		minimumContentCoverage: { width: 80, height: 75 }
	},
	{
		id: 'empty',
		fixture: createFixture('kpi-operations-empty', null),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 75, height: 55 }
	},
	{
		id: 'long-labels',
		fixture: createFixture(
			'kpi-operations-long-labels',
			{
				...operationsData,
				metrics: [
					{ label: 'Orders completed across all fulfillment locations', value: 1842, unit: 'orders', delta: '+8.4% vs previous operating day', tone: 'positive' },
					{ label: 'Shipments dispatched within the committed service window', value: 96.8, unit: '%', delta: '1.2 pts above target', tone: 'positive' },
					{ label: 'Open exceptions requiring supervisor attention', value: 17, unit: 'cases', delta: '5 need attention', tone: 'warning' }
				]
			},
			{ ...baseConfig, titleText: 'European distribution operations performance' }
		),
		viewport: { width: 1536, height: 432, background: 'dark' },
		minimumContentCoverage: { width: 80, height: 75 }
	},
	{
		id: 'live-update',
		fixture: createFixture('kpi-operations-live-update', operationsData),
		viewport: { width: 1280, height: 720, background: 'dark' },
		minimumContentCoverage: { width: 80, height: 75 },
		liveDatasourceUpdate: {
			property: 'operationsData',
			value: {
				...operationsData,
				metrics: [
					{ ...operationsData.metrics[0], label: 'Orders updated from the live datasource' },
					...operationsData.metrics.slice(1)
				]
			},
			expectedText: 'Orders updated from the live datasource'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '.wb-app',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
