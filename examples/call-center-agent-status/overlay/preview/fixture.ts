import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

type PreviewAgent = Record<string, unknown>;

const sampleDatasource: PreviewAgent[] = sampleDatasourceJson as PreviewAgent[];
const baseConfig: Record<string, unknown> = {
	titleText: 'Agent status wall',
	subtitleText: 'Live workforce activity',
	emptyStateText: 'No agent records are currently available.',
	pageDurationSeconds: 3,
	fontFamily: "'Segoe UI', Arial, sans-serif",
	backgroundColor: '#111416',
	surfaceColor: '#1c2225',
	primaryTextColor: '#f5f3ec',
	secondaryTextColor: '#aab3b7',
	readyColor: '#4fd3a3',
	busyColor: '#ff6666',
	acwColor: '#f4bd4f',
	awayColor: '#e98a50',
	offlineColor: '#758087',
	unknownColor: '#68a7d3'
};

const createFixture = (id: string, data: unknown): PreviewFixture => ({
	id,
	readySelector: '.agent-header h1',
	configValues: baseConfig,
	dataPickerValues: { agentData: data },
	datasourceIds: { agentData: 'preview-agent-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('call-center-agent-status-preview', sampleDatasource);
const longLabelRows: PreviewAgent[] = sampleDatasource
	.slice(0, 8)
	.map((row: PreviewAgent, index: number): PreviewAgent =>
		index === 0
			? { ...row, Name: 'Alexandria Montgomery-Sutherland', State: 'After Call Work - Customer Documentation' }
			: row
	);
const invalidRows: PreviewAgent[] = [
	...sampleDatasource.slice(0, 4),
	{ State: 'Ready', Handled: 99 },
	null as unknown as PreviewAgent
];
const liveUpdateRows: PreviewAgent[] = sampleDatasource.map((row: PreviewAgent, index: number): PreviewAgent =>
	index === 0 ? { ...row, State: 'Talking', Handled: 99, Duration_Time: '00:00:17' } : row
);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'mixed-states',
		fixture: createFixture('agent-status-mixed', sampleDatasource),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 88 }
	},
	{
		id: 'second-page',
		fixture: createFixture('agent-status-second-page', sampleDatasource),
		viewport: { width: 1366, height: 768, background: 'dark' },
		advanceTimeMs: 3500,
		minimumContentCoverage: { width: 90, height: 85 }
	},
	{
		id: 'empty',
		fixture: createFixture('agent-status-empty', []),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 86, height: 55 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('agent-status-long-labels', longLabelRows),
		viewport: { width: 1536, height: 432, background: 'dark' },
		minimumContentCoverage: { width: 92, height: 84 }
	},
	{
		id: 'unknown-state',
		fixture: createFixture('agent-status-unknown', [{ ...sampleDatasource[0], State: 'Training' }]),
		viewport: { width: 600, height: 600, background: 'dark' },
		minimumContentCoverage: { width: 86, height: 86 }
	},
	{
		id: 'invalid-rows',
		fixture: createFixture('agent-status-invalid', invalidRows),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 86, height: 75 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('agent-status-live-update', sampleDatasource.slice(0, 8)),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 85 },
		liveDatasourceUpdate: {
			property: 'agentData',
			value: liveUpdateRows.slice(0, 8),
			expectedText: '99'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [];

export default previewFixture;
