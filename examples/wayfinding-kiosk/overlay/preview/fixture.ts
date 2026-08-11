import sampleDatasource from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

const defaultConfig: Record<string, unknown> = {
	venueName: 'Northline Campus',
	welcomeMessage: 'Where would you like to go?',
	themePreset: 'dark',
	accentColor: '#67e0c4',
	textColor: '#f4faf8',
	backgroundColor: '#0a1110',
	panelColor: '#111b19',
	mutedColor: '#91a8a3'
};

const createFixture = (
	id: string,
	configValues: Record<string, unknown> = defaultConfig,
	destinationData: unknown = sampleDatasource
): PreviewFixture => ({
	id,
	readySelector: '[data-preview-id="wayfinding-kiosk-root"][data-viewer-ready="true"]',
	settleMs: 2_000,
	configValues,
	dataPickerValues: { destinationData },
	datasourceIds: { destinationData: 'wayfinding-destination-status' },
	additionalConfig: {
		licenseType: null,
		mockDatasource: {},
		style: {}
	}
});

const previewFixture: PreviewFixture = createFixture('wayfinding-kiosk-default');

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'full-hd-overview',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 93, height: 95 }
	},
	{
		id: 'normal-3d-overview',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'dark' },
		interactionSteps: [
			{ type: 'click', role: 'button', name: '3D' }
		],
		minimumContentCoverage: { width: 93, height: 95 }
	},
	{
		id: 'route-preview',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'dark' },
		interactionSteps: [
			{ type: 'click', role: 'button', name: 'Visitor services Ground floor Open' }
		],
		minimumContentCoverage: { width: 93, height: 95 }
	},
	{
		id: 'route-journey',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'dark' },
		interactionSteps: [
			{ type: 'click', role: 'button', name: 'Visitor services Ground floor Open' },
			{ type: 'click', role: 'button', name: 'Start 3D route Full journey with camera and spoken guidance' }
		],
		minimumContentCoverage: { width: 93, height: 95 }
	},
	{
		id: 'live-unavailable-status',
		fixture: createFixture('wayfinding-kiosk-unavailable', defaultConfig, {
			DestinationStatus: {
				rows: [
					{
						destinationId: 'library-help',
						available: false,
						status: 'Temporarily closed',
						waitMinutes: 0,
						note: 'Visitor assistance has moved to the east lobby.'
					}
				]
			}
		}),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		interactionSteps: [
			{ type: 'click', role: 'button', name: 'Visitor services Ground floor Temporarily closed' }
		],
		minimumContentCoverage: { width: 93, height: 95 }
	},
	{
		id: 'light-theme',
		fixture: createFixture('wayfinding-kiosk-light', { ...defaultConfig, themePreset: 'light' }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 93, height: 95 }
	},
	{
		id: 'custom-theme',
		fixture: createFixture('wayfinding-kiosk-custom', { ...defaultConfig, themePreset: 'custom' }),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 93, height: 95 }
	},
	{
		id: 'long-copy',
		fixture: createFixture('wayfinding-kiosk-long-copy', {
			...defaultConfig,
			venueName: 'Northline Interdisciplinary Research and Visitor Campus',
			welcomeMessage: 'Which destination, visitor service, or learning space would you like to find today?'
		}),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 93, height: 95 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '[data-preview-id="wayfinding-kiosk-root"]',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'accent-color',
		property: 'accentColor',
		changedValue: '#ff6b4a',
		selector: '[data-preview-id="wayfinding-kiosk-root"]',
		scenario: 'custom-theme',
		measurement: { type: 'computed-style', property: '--wb-wayfinding-kiosk-accent' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
