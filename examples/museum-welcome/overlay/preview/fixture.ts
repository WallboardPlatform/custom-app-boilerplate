import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

const baseConfigValues: Record<string, unknown> = {
	exhibitionTitle: 'FORM IN MOTION',
	subtitle: 'Kinetic sculpture and modern light',
	dateRange: '14 SEP - 22 JAN',
	venue: 'GALLERY 2',
	heroImage: '',
	showSubtitle: true,
	showDate: true,
	showVenue: true,
	showImage: true,
	transparentBackground: false,
	themePreset: 'light',
	backgroundColor: '#eeeae2',
	primaryColor: '#ed3f2f',
	secondaryColor: '#185bd8',
	accentColor: '#f3c625',
	textColor: '#111111',
	inverseTextColor: '#eeeae2'
};

const fixture = (id: string, overrides: Record<string, unknown> = {}): PreviewFixture => ({
	id,
	readySelector: '.museum-render-ready',
	configValues: {
		...baseConfigValues,
		...overrides
	},
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: {
		licenseType: null,
		mockDatasource: {},
		style: {}
	}
});

const previewFixture: PreviewFixture = fixture('calder-museum-welcome-preview');

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'minimal',
		fixture: fixture('calder-museum-minimal', {
			showSubtitle: false,
			showDate: false,
			showVenue: false,
			showImage: false
		}),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 56, height: 43 }
	},
	{
		id: 'long-title',
		fixture: fixture('calder-museum-long-title', {
			exhibitionTitle: 'THE UNEXPECTED GEOMETRY OF AIR AND EVERYDAY MOTION',
			subtitle: 'Suspended color, quiet balance, and the architecture of movement across five new installations',
			dateRange: '14 SEPTEMBER 2026 - 22 JANUARY 2027',
			venue: 'SCULPTURE GALLERY / LEVEL 2'
		}),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 87, height: 82 }
	},
	{
		id: 'no-image',
		fixture: fixture('calder-museum-no-image', {
			showImage: false
		}),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 87, height: 82 }
	},
	{
		id: 'broken-image',
		fixture: fixture('calder-museum-broken-image', {
			heroImage: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
		}),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 87, height: 82 }
	},
	{
		id: 'alternate-colors',
		fixture: fixture('calder-museum-alternate-colors', {
			themePreset: 'custom',
			backgroundColor: '#f2eee6',
			primaryColor: '#20201f',
			secondaryColor: '#e85d3f',
			accentColor: '#8ed1c7',
			textColor: '#151515',
			inverseTextColor: '#f8f5ed'
		}),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 87, height: 82 }
	},
	{
		id: 'transparent-background',
		fixture: fixture('calder-museum-transparent-background', {
			transparentBackground: true
		}),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 87, height: 82 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'image-source',
		property: 'heroImage',
		changedValue: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' fill='%23185bd8'/%3E%3C/svg%3E",
		selector: '.museum-artwork',
		measurement: { type: 'attribute', name: 'src' },
		expectation: { type: 'change' }
	},
	{
		id: 'subtitle-visibility',
		property: 'showSubtitle',
		changedValue: false,
		selector: '.museum-subtitle',
		measurement: { type: 'attribute', name: 'data-visible' },
		expectation: { type: 'change' }
	},
	{
		id: 'date-visibility',
		property: 'showDate',
		changedValue: false,
		selector: '.museum-date',
		measurement: { type: 'attribute', name: 'data-visible' },
		expectation: { type: 'change' }
	},
	{
		id: 'venue-visibility',
		property: 'showVenue',
		changedValue: false,
		selector: '.museum-venue',
		measurement: { type: 'attribute', name: 'data-visible' },
		expectation: { type: 'change' }
	},
	{
		id: 'image-visibility',
		property: 'showImage',
		changedValue: false,
		selector: '.museum-image-field',
		measurement: { type: 'attribute', name: 'data-image-state' },
		expectation: { type: 'change' }
	},
	{
		id: 'background-transparency',
		property: 'transparentBackground',
		changedValue: true,
		selector: '.wb-app',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'dark',
		selector: '.museum-left-field',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
