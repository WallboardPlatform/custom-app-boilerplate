import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

import sampleQuestionData from '../sample-questions-datasource.json';
import sampleResultsData from '../sample-results-datasource.json';

const baseConfig: Record<string, unknown> = {
	plantName: 'Northline Mobility',
	welcomeTitle: 'Ready for your safety check?',
	introText: 'Three quick questions help keep every production zone safe.',
	identityPrompt: 'Enter your name and corporate ID to begin.',
	completionResetSeconds: 10,
	inactivityResetSeconds: 120,
	resultRetentionLimit: 1000,
	motionPreset: 'subtle',
	themePreset: 'dark',
	backgroundColor: '#071313',
	surfaceColor: '#102322',
	primaryTextColor: '#f7f2e8',
	secondaryTextColor: '#a9bfba',
	accentColor: '#e64b38'
};

const longQuestionData: Record<string, unknown> = {
	Questions: {
		header: sampleQuestionData.Questions.header,
		rows: [
			{
				questionId: 'long-01',
				sortOrder: 1,
				enabled: true,
				prompt: 'Before entering an active assembly zone with suspended equipment, which preparation protects you and the production team most effectively?',
				optionA: 'Walk directly under the equipment if no alarm is sounding',
				optionB: 'Confirm the marked route, required PPE, and current exclusion zones before entry',
				optionC: 'Ask another visitor to enter first and follow their route',
				optionD: 'Use any available aisle when the marked route appears busy',
				correctOption: 'B',
				explanation: 'The marked route and current controls must be confirmed before entering.'
			},
			...sampleQuestionData.Questions.rows.slice(1)
		],
		connectors: {}
	}
};

const createFixture = (
	id: string,
	questionData: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '[data-preview-id="factory-safety-root"]',
	settleMs: 650,
	configValues,
	dataPickerValues: {
		questionData,
		resultsData: sampleResultsData
	},
	datasourceIds: {
		questionData: 'preview-safety-questions',
		resultsData: 'preview-safety-results'
	},
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} },
	platform: {
		isDisplayer: true,
		internalDatasources: {
			'preview-safety-questions': questionData,
			'preview-safety-results': sampleResultsData
		}
	}
});

const previewFixture: PreviewFixture = createFixture('factory-safety-preview', sampleQuestionData);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'full-hd',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 82, height: 72 }
	},
	{
		id: 'compact',
		fixture: createFixture('factory-safety-compact', sampleQuestionData, { ...baseConfig, themePreset: 'light' }),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 82, height: 72 }
	},
	{
		id: 'identity',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Start safety check' }],
		minimumContentCoverage: { width: 82, height: 72 }
	},
	{
		id: 'long-welcome',
		fixture: createFixture('factory-safety-long', longQuestionData, {
			...baseConfig,
			motionPreset: 'off',
			themePreset: 'custom',
			welcomeTitle: 'Complete the production-floor safety and controlled-access readiness check'
		}),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 82, height: 72 }
	},
	{
		id: 'long-question',
		fixture: createFixture('factory-safety-long-question', longQuestionData, {
			...baseConfig,
			motionPreset: 'off'
		}),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		interactionSteps: [
			{ type: 'click', role: 'button', name: 'Start safety check' },
			{ type: 'fill', label: 'Full name', value: 'Morgan Lee' },
			{ type: 'fill', label: 'Corporate ID', value: 'NM-2020' },
			{ type: 'click', role: 'button', name: 'Continue' }
		],
		minimumContentCoverage: { width: 82, height: 72 }
	},
	{
		id: 'empty',
		fixture: createFixture('factory-safety-empty', { Questions: { rows: [] } }),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 82, height: 72 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '[data-preview-id="factory-safety-root"]',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'accent-color',
		property: 'accentColor',
		changedValue: '#0066ff',
		selector: '[data-preview-id="factory-safety-root"]',
		scenario: 'long-welcome',
		measurement: { type: 'computed-style', property: '--wb-factory-safety-accent' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
