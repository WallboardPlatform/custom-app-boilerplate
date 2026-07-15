import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

type PreviewSkillRow = Record<string, unknown>;

interface PreviewSkillDatasource {
	'json_file_update_timestamep (every 3 seconds)': string;
	data: Record<string, PreviewSkillRow>;
}

const sampleDatasource: PreviewSkillDatasource = sampleDatasourceJson as PreviewSkillDatasource;
const baseConfig: Record<string, unknown> = {
	titleText: 'Skill operations',
	subtitleText: 'Live coverage and agent activity',
	emptyStateText: 'No active skill records are currently available.',
	rotationSeconds: 3,
	maxAgentsShown: 12,
	themePreset: 'dark',
	fontFamily: "'Segoe UI', Arial, sans-serif",
	backgroundColor: '#071b29',
	surfaceColor: '#0f2a3a',
	primaryTextColor: '#f2f7f9',
	secondaryTextColor: '#8fa8b8',
	readyColor: '#3ad0a0',
	activeColor: '#45a9e6',
	acwColor: '#efb84b',
	awayColor: '#ef8151',
	offlineColor: '#647985',
	unknownColor: '#8c7bd3'
};

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.skill-header h1',
	configValues,
	dataPickerValues: { skillData: data },
	datasourceIds: { skillData: 'preview-skill-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const sentinel: PreviewSkillRow = sampleDatasource.data.sentinel;
const longLabelDatasource: PreviewSkillDatasource = {
	'json_file_update_timestamep (every 3 seconds)': sampleDatasource['json_file_update_timestamep (every 3 seconds)'],
	data: {
		long: {
			...sampleDatasource.data['technical-agent-10'],
			unique_agent: 'long-label-agent',
			resourceid: 41001,
			agent_name: 'Sample Agent with an Exceptionally Long Display Name',
			skillname: 'Regional Customer Support and Account Resolution',
			agent_state_reason: 'Customer documentation and escalation follow-up'
		}
	}
};
const stateSequence: string[] = ['Ready', 'Talking', 'ACW', 'Not Ready', 'Logged out', 'Training'];
const denseRows: Record<string, PreviewSkillRow> = Array.from(
	{ length: 18 },
	(_: unknown, index: number): PreviewSkillRow => ({
		Time_Stamp: '2024-01-15 09:30:00.000000',
		unique_agent: `dense-${index + 1}`,
		filter_field: `SAMPLE_Account_Escalations_${index + 1}`,
		resourceid: 42000 + index,
		agent_name: `Agent ${String(index + 1).padStart(2, '0')}`,
		team_id: 21,
		skillname: 'Account Services Escalations',
		business_unit: 'ACCT',
		agent_state: stateSequence[index % stateSequence.length],
		agent_state_reason: stateSequence[index % stateSequence.length],
		reasoncode: '',
		duration: 45 + index * 12,
		duration_time: `00:0${index % 9}:${String((index * 7) % 60).padStart(2, '0')}`
	})
).reduce((result: Record<string, PreviewSkillRow>, row: PreviewSkillRow): Record<string, PreviewSkillRow> => {
	result[String(row.unique_agent)] = row;
	return result;
}, {});
const denseDatasource: PreviewSkillDatasource = {
	'json_file_update_timestamep (every 3 seconds)': sampleDatasource['json_file_update_timestamep (every 3 seconds)'],
	data: denseRows
};
const liveUpdateDatasource: PreviewSkillDatasource = {
	...sampleDatasource,
	data: {
		...sampleDatasource.data,
		'account-agent-14': {
			...sampleDatasource.data['account-agent-01'],
			unique_agent: 'account-agent-14',
			resourceid: 43001,
			agent_name: 'Sample Agent 14',
			agent_state: 'Ready',
			duration_time: '00:00:11'
		}
	}
};

const previewFixture: PreviewFixture = createFixture('call-center-skill-operations-preview', sampleDatasource);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'compact-dark-theme',
		fixture: createFixture('skill-operations-compact-dark-theme', sampleDatasource),
		viewport: { width: 932, height: 397, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'compact-light-theme',
		fixture: createFixture('skill-operations-compact-light-theme', sampleDatasource, {
			...baseConfig,
			themePreset: 'light'
		}),
		viewport: { width: 932, height: 397, background: 'light' },
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'light-theme',
		fixture: createFixture('skill-operations-light-theme', sampleDatasource, { ...baseConfig, themePreset: 'light' }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 90, height: 88 }
	},
	{
		id: 'mixed-skills',
		fixture: createFixture('skill-operations-mixed', sampleDatasource),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 88 }
	},
	{
		id: 'empty-sentinel',
		fixture: createFixture('skill-operations-empty-sentinel', {
			'json_file_update_timestamep (every 3 seconds)':
				sampleDatasource['json_file_update_timestamep (every 3 seconds)'],
			data: { sentinel }
		}),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 80, height: 55 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('skill-operations-long-labels', longLabelDatasource, {
			...baseConfig,
			titleText: 'Regional skill coverage and workforce operations'
		}),
		viewport: { width: 1536, height: 432, background: 'dark' },
		minimumContentCoverage: { width: 92, height: 84 }
	},
	{
		id: 'dense-roster',
		fixture: createFixture('skill-operations-dense', denseDatasource),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 88 }
	},
	{
		id: 'unknown-state',
		fixture: createFixture('skill-operations-unknown', {
			'json_file_update_timestamep (every 3 seconds)':
				sampleDatasource['json_file_update_timestamep (every 3 seconds)'],
			data: {
				unknown: {
					...sampleDatasource.data['account-agent-01'],
					unique_agent: 'unknown-agent',
					resourceid: 44001,
					agent_state: 'Training',
					agent_state_reason: 'Training'
				}
			}
		}),
		viewport: { width: 1280, height: 720, background: 'dark' },
		minimumContentCoverage: { width: 86, height: 70 }
	},
	{
		id: 'rotation',
		fixture: createFixture('skill-operations-rotation', sampleDatasource),
		viewport: { width: 1366, height: 768, background: 'dark' },
		advanceTimeMs: 3500,
		minimumContentCoverage: { width: 90, height: 88 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('skill-operations-live-update', sampleDatasource),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 88 },
		liveDatasourceUpdate: {
			property: 'skillData',
			value: liveUpdateDatasource,
			expectedText: 'Sample Agent 14'
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
