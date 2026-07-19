import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

const folderId = 'preview-pdf-folder';
const handbook = {
	id: 'northline-handbook',
	name: 'northline-operations-handbook.pdf',
	location: '/preview/pdf-assets/northline-operations-handbook.pdf',
	contentType: 'PDF'
};
const shiftBrief = {
	id: 'northline-shift-brief',
	name: 'northline-shift-brief.pdf',
	location: '/preview/pdf-assets/northline-shift-brief.pdf',
	contentType: 'PDF'
};

const baseConfig: Record<string, unknown> = {
	sourceMode: 'folder',
	pdfFile: handbook,
	pdfFolder: { id: folderId, name: 'Northline document set' },
	recursiveFolder: true,
	password: '',
	title: 'Document workspace',
	pageMode: 'continuous',
	scrollDirection: 'vertical',
	fit: 'contain',
	initialPage: 1,
	pageStart: 1,
	pageEnd: 0,
	showSidebar: true,
	showControls: true,
	hideScrollbars: false,
	sidebarDefault: 'documents',
	renderTextLayer: true,
	interactiveAnnotations: true,
	renderForms: true,
	preloadScreens: 1,
	pagePadding: 18,
	separatorSize: 1,
	separatorColor: '#27322f',
	zoomMinimum: 0.35,
	zoomMaximum: 4,
	zoomStep: 0.15,
	autoScrollEnabled: false,
	autoScrollSpeed: 36,
	autoScrollEndPauseSeconds: 3,
	autoScrollRewindSeconds: 1.5,
	autoScrollPauseOnHover: true,
	themePreset: 'dark',
	backgroundColor: '#101514',
	panelColor: '#18201e',
	toolbarColor: '#121918',
	primaryTextColor: '#f5f2e9',
	mutedTextColor: '#9caaa6',
	borderColor: '#34413e',
	accentColor: '#42d6b5'
};

const createFixture = (id: string, configValues: Record<string, unknown>): PreviewFixture => ({
	id,
	readySelector: `[data-preview-id="pdf-document-workspace-root"][data-source-count="${configValues.sourceMode === 'file' ? 1 : 2}"]`,
	settleMs: 1300,
	configValues,
	dataPickerValues: {},
	datasourceIds: {},
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} },
	platform: {
		isDisplayer: true,
		filesByFolder: {
			[folderId]: [handbook, shiftBrief]
		}
	}
});

const previewFixture: PreviewFixture = createFixture('pdf-workspace-preview', baseConfig);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'full-hd',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'portrait',
		fixture: createFixture('pdf-workspace-portrait', { ...baseConfig, themePreset: 'light' }),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 94, height: 95 }
	},
	{
		id: 'compact',
		fixture: createFixture('pdf-workspace-compact', {
			...baseConfig,
			fit: 'width',
			pdfFile: handbook,
			showSidebar: false,
			sourceMode: 'file'
		}),
		viewport: { width: 800, height: 600, background: 'dark' },
		minimumContentCoverage: { width: 95, height: 91 }
	},
	{
		id: 'single-page',
		fixture: createFixture('pdf-workspace-single', {
			...baseConfig,
			pageMode: 'single',
			sidebarDefault: 'outline',
			themePreset: 'custom',
			backgroundColor: '#171225',
			panelColor: '#241d35',
			toolbarColor: '#1d172b',
			primaryTextColor: '#fff9eb',
			mutedTextColor: '#bdb3ce',
			borderColor: '#514663',
			accentColor: '#ffbf4b'
		}),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 91 }
	},
	{
		id: 'auto-scroll',
		fixture: createFixture('pdf-workspace-auto-scroll', {
			...baseConfig,
			autoScrollEnabled: true,
			autoScrollPauseOnHover: false,
			autoScrollSpeed: 240,
			showSidebar: false
		}),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 95, height: 91 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '[data-preview-id="pdf-document-workspace-root"]',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'custom-accent',
		property: 'accentColor',
		changedValue: '#ff4f86',
		selector: '[data-preview-id="pdf-document-workspace-root"]',
		scenario: 'single-page',
		measurement: { type: 'computed-style', property: '--wb-pdf-workspace-accent' },
		expectation: { type: 'change' }
	},
	{
		id: 'page-spacing',
		property: 'pagePadding',
		changedValue: 72,
		selector: '[data-global-page="1"]',
		measurement: { type: 'computed-style', property: '--pdf-page-padding' },
		expectation: { type: 'change' }
	},
	{
		id: 'separator-width',
		property: 'separatorSize',
		changedValue: 8,
		selector: '[data-preview-id="pdf-document-workspace-root"]',
		measurement: { type: 'attribute', name: 'data-separator-size' },
		expectation: { type: 'change' }
	},
	{
		id: 'auto-scroll-speed',
		property: 'autoScrollSpeed',
		changedValue: 180,
		selector: '[data-preview-id="pdf-document-workspace-root"]',
		measurement: { type: 'attribute', name: 'data-auto-scroll-speed' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
