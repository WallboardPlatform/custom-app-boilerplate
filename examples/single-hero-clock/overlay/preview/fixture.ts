import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

const baseConfig: Record<string, unknown> = {
	locationLabel: 'Budapest',
	timezone: 'Europe/Budapest',
	hourFormat: '24',
	dateFormat: 'medium',
	showSeconds: true,
	showDate: true,
	showZone: true,
	fontScale: 100,
	themePreset: 'dark',
	accentColor: '#58e4c1',
	textColor: '#f6f4ed',
	backgroundColor: '#101516',
	backgroundOpacity: 94
};

const createFixture = (id: string, configValues: Record<string, unknown>): PreviewFixture => ({
	id,
	readySelector: '.wb-single-hero-clock-time',
	configValues,
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: {
		licenseType: null,
		mockDatasource: {},
		style: {}
	}
});

const previewFixture: PreviewFixture = createFixture('single-hero-clock-default', baseConfig);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'light-theme',
		fixture: createFixture('single-hero-clock-light-theme', { ...baseConfig, themePreset: 'light' }),
		viewport: { width: 1280, height: 720, background: 'light' },
		minimumContentCoverage: { width: 70, height: 70 }
	},
	{
		id: 'minimal',
		fixture: createFixture('single-hero-clock-minimal', {
			...baseConfig,
			showSeconds: false,
			showDate: false,
			showZone: false
		}),
		viewport: { width: 600, height: 600, background: 'checker' },
		minimumContentCoverage: { width: 83, height: 50 }
	},
	{
		id: 'invalid-timezone',
		fixture: createFixture('single-hero-clock-invalid-timezone', {
			...baseConfig,
			timezone: 'Invalid/Timezone'
		}),
		viewport: { width: 1280, height: 720, background: 'dark' },
		minimumContentCoverage: { width: 87, height: 80 }
	},
	{
		id: 'long-label',
		fixture: createFixture('single-hero-clock-long-label', {
			...baseConfig,
			locationLabel: 'International Operations Coordination Center',
			dateFormat: 'long'
		}),
		viewport: { width: 320, height: 180, background: 'light' },
		minimumContentCoverage: { width: 85, height: 76 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '.wb-single-hero-clock-root',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'font-scale',
		property: 'fontScale',
		changedValue: 125,
		selector: '.wb-single-hero-clock-time',
		measurement: { type: 'bounding-box', dimension: 'width' },
		expectation: { type: 'increase', minimumDelta: 20 }
	}
];

export default previewFixture;
