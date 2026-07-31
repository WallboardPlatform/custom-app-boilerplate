import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

const baseConfig: Record<string, unknown> = {
	title: 'Northline Campus',
	defaultView: '3d',
	motionPreset: 'subtle',
	showViewSwitcher: true,
	themePreset: 'light',
	backgroundColor: '#e8ece7',
	panelColor: '#fffdf7',
	primaryTextColor: '#15302b',
	secondaryTextColor: '#667973',
	accentColor: '#bd6d1d'
};

const createFixture = (id: string, configValues: Record<string, unknown> = baseConfig): PreviewFixture => ({
	id,
	readySelector: '[data-preview-id="spatial-wayfinding-root"]',
	settleMs: 1400,
	configValues,
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('spatial-wayfinding-default');

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'app-default',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 99, height: 97 }
	},
	{
		id: 'compact',
		fixture: createFixture('spatial-wayfinding-compact'),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 98, height: 96 }
	},
	{
		id: 'flat-map',
		fixture: createFixture('spatial-wayfinding-flat', { ...baseConfig, defaultView: '2d' }),
		interactionSteps: [{ type: 'click', role: 'button', name: 'Events / G21 The Forum Next' }],
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 99, height: 97 }
	},
	{
		id: 'dark-theme',
		fixture: createFixture('spatial-wayfinding-dark', { ...baseConfig, themePreset: 'dark' }),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 98, height: 96 }
	},
	{
		id: 'multi-building-site',
		fixture: createFixture('spatial-wayfinding-multi-building-site', { ...baseConfig, defaultView: '2d', title: 'Northline Multi-Building Campus' }),
		interactionSteps: [{ type: 'click', role: 'button', name: 'Building / 3 levels Library Explore inside' }],
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 99, height: 97 }
	},
	{
		id: 'multi-building-atlas',
		fixture: createFixture('spatial-wayfinding-multi-building-atlas', { ...baseConfig, defaultView: '2d', title: 'Northline Multi-Building Campus' }),
		interactionSteps: [
			{ type: 'click', role: 'button', name: 'Building / 3 levels Library Explore inside' },
			{ type: 'click', role: 'button', name: 'Directions' }
		],
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 98, height: 96 }
	},
	{
		id: 'multi-building-exploded',
		fixture: createFixture('spatial-wayfinding-multi-building-exploded', { ...baseConfig, defaultView: '3d', title: 'Northline Multi-Building Campus' }),
		interactionSteps: [
			{ type: 'click', role: 'button', name: 'Library Special Collections' },
			{ type: 'click', role: 'button', name: 'Exploded 3D' }
		],
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 99, height: 97 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'dark',
		selector: '[data-preview-id="spatial-wayfinding-root"]',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'default-view',
		property: 'defaultView',
		changedValue: '2d',
		selector: '[data-preview-id="spatial-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-view' },
		expectation: { type: 'change' }
	},
	{
		id: 'motion-preset',
		property: 'motionPreset',
		changedValue: 'off',
		selector: '[data-preview-id="spatial-wayfinding-root"]',
		measurement: { type: 'attribute', name: 'data-motion' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
