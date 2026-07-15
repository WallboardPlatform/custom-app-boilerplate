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
	fontFamily: "'Segoe UI', Arial, sans-serif",
	backgroundColor: '#111416',
	surfaceColor: '#1c2225',
	primaryTextColor: '#f5f3ec',
	secondaryTextColor: '#aab3b7',
	readyColor: '#4fd3a3',
	activeColor: '#ff6666',
	acwColor: '#f4bd4f',
	awayColor: '#e98a50',
	offlineColor: '#758087',
	unknownColor: '#68a7d3'
};

const createFixture = (id: string, data: unknown): PreviewFixture => ({
	id,
	readySelector: '.skill-header h1',
	configValues: baseConfig,
	dataPickerValues: { skillData: data },
	datasourceIds: { skillData: 'preview-skill-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const sentinel: PreviewSkillRow = sampleDatasource.data.sentinel;
const longLabelDatasource: PreviewSkillDatasource = {
	'json_file_update_timestamep (every 3 seconds)': sampleDatasource['json_file_update_timestamep (every 3 seconds)'],
	data: {
		long: {
			...sampleDatasource.data['emergency-devon'],
			unique_agent: 'long-label-agent',
			resourceid: 41001,
			agent_name: 'Alexandria Montgomery-Sutherland',
			skillname: 'Enterprise Emergency Response and Customer Resolution',
			agent_state_reason: 'Customer documentation and escalation follow-up'
		}
	}
};
const stateSequence: string[] = ['Ready', 'Talking', 'ACW', 'Not Ready', 'Logged out', 'Training'];
const denseRows: Record<string, PreviewSkillRow> = Array.from(
	{ length: 18 },
	(_: unknown, index: number): PreviewSkillRow => ({
		Time_Stamp: '2026-07-15 10:42:18.953000',
		unique_agent: `dense-${index + 1}`,
		filter_field: `Queue_Billing_Escalations_${index + 1}`,
		resourceid: 42000 + index,
		agent_name: `Agent ${String(index + 1).padStart(2, '0')}`,
		team_id: 21,
		skillname: 'Billing Escalations',
		business_unit: 'BILL',
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
		'billing-nora': {
			...sampleDatasource.data['billing-avery'],
			unique_agent: 'billing-nora',
			resourceid: 43001,
			agent_name: 'Nora Stone',
			agent_state: 'Ready',
			duration_time: '00:00:11'
		}
	}
};

const previewFixture: PreviewFixture = createFixture('call-center-skill-operations-preview', sampleDatasource);

export const previewScenarios: PreviewScenario[] = [
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
		fixture: createFixture('skill-operations-long-labels', longLabelDatasource),
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
					...sampleDatasource.data['billing-avery'],
					unique_agent: 'unknown-agent',
					resourceid: 44001,
					agent_state: 'Training',
					agent_state_reason: 'Training'
				}
			}
		}),
		viewport: { width: 600, height: 600, background: 'dark' },
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
			expectedText: 'Nora Stone'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [];

export default previewFixture;
