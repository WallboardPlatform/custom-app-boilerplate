import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

import sampleResultsData from '../sample-results-datasource.json';

const baseConfig: Record<string, unknown> = {
	plantName: 'Northline Mobility',
	title: 'Safety readiness dashboard',
	passThreshold: 80,
	maximumRows: 6,
	showCorporateId: false,
	fontFamily: 'Arial',
	themePreset: 'dark',
	backgroundColor: '#071313',
	surfaceColor: '#102321',
	surfaceStrongColor: '#17302d',
	borderColor: '#29413e',
	primaryTextColor: '#f7f2e8',
	secondaryTextColor: '#9eb4ae',
	accentColor: '#ef5b45',
	passColor: '#59ddaf',
	dangerColor: '#ff6c5c'
};

const createFixture = (
	id: string,
	resultsData: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '[data-preview-id="factory-safety-dashboard-root"]',
	settleMs: 350,
	configValues,
	dataPickerValues: { resultsData },
	datasourceIds: { resultsData: 'preview-safety-results' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} },
	platform: {
		isDisplayer: true,
		internalDatasources: { 'preview-safety-results': resultsData }
	}
});

const previewFixture: PreviewFixture = createFixture('factory-safety-dashboard-preview', sampleResultsData);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'full-hd',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'compact',
		fixture: createFixture('factory-safety-dashboard-compact', sampleResultsData, { ...baseConfig, themePreset: 'light' }),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'corporate-ids',
		fixture: createFixture('factory-safety-dashboard-ids', sampleResultsData, { ...baseConfig, showCorporateId: true }),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'long-title',
		fixture: createFixture('factory-safety-dashboard-long', sampleResultsData, {
			...baseConfig,
			title: 'Assembly workforce safety qualification and readiness performance overview'
		}),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'empty',
		fixture: createFixture('factory-safety-dashboard-empty', { Results: { rows: [] } }),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 55 }
	},
	{
		id: 'row-array',
		fixture: createFixture('factory-safety-dashboard-array', sampleResultsData.Results.rows.slice(0, 4)),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 86 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '[data-preview-id="factory-safety-dashboard-root"]',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'pass-threshold',
		property: 'passThreshold',
		changedValue: 60,
		selector: '[data-metric="pass-rate"]',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
