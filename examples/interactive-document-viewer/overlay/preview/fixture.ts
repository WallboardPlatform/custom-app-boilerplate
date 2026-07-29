import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface DocumentRow extends Record<string, unknown> {
	Name: string;
	Date: string;
	PDF?: { id: string; name: string; location: string } | null;
	Category: string;
	Scheduling?: unknown;
	Department?: string;
	Status?: string;
	Audience?: string;
	Updated?: string;
}

interface DocumentsDatasource {
	Documents: {
		header: Record<string, string>;
		rows: DocumentRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource = sampleDatasourceJson as DocumentsDatasource;
const sampleRows = sampleDatasource.Documents.rows;

const baseConfig: Record<string, unknown> = {
	titleColumn: 'Name',
	pdfColumn: 'PDF',
	categoryColumn: 'Category',
	metadataColumn1: 'Date',
	metadataColumn2: 'Category',
	metadataColumn3: '',
	metadataColumn4: '',
	metadataColumn5: '',
	metadataColumn6: '',
	scheduleColumn: 'Scheduling',
	scheduleRetentionDays: 0,
	showEyebrow: false,
	eyebrowText: 'Public information kiosk',
	showAppTitle: false,
	appTitle: 'Community Documents',
	logoFile: null,
	showClock: true,
	timeFormat: '12',
	dateFormat: 'long',
	pageMode: 'single',
	fit: 'contain',
	showControls: true,
	renderTextLayer: true,
	interactiveAnnotations: true,
	renderForms: true,
	zoomMinimum: 0.5,
	zoomMaximum: 4,
	zoomStep: 0.2,
	portraitReaderFirst: true,
	portraitReaderAfterSelection: true,
	keyboardEnabled: true,
	keyboardTextScale: 100,
	showAccessibilityButton: false,
	searchPlaceholder: 'Search documents',
	showDirectoryIcon: true,
	directoryIconFile: null,
	backgroundMode: 'gradient',
	backgroundImage: null,
	backgroundColor: '#ffffff',
	backgroundColorTwo: '#eef6ff',
	panelColor: '#09265f',
	buttonColor: '#0a2d6f',
	buttonTextColor: '#ffffff',
	listColor: '#ffffff',
	primaryTextColor: '#14233a',
	mutedTextColor: '#60708a',
	keyboardColor: '#ffffff',
	keyboardKeyColor: '#e8eef5',
	screensaverEnabled: true,
	idleSeconds: 120,
	screensaverImage: null,
	screensaverOverlayColor: '#051b45',
	screensaverLogoFile: null,
	screensaverMessage: 'Touch anywhere to explore community documents',
	screensaverSubtext: 'Tap or press any key to begin'
};

const withRows = (rows: DocumentRow[]): DocumentsDatasource => ({
	Documents: {
		header: {
			...sampleDatasource.Documents.header,
			Department: 'string',
			Status: 'dropdown',
			Audience: 'text',
			Updated: 'date'
		},
		rows,
		connectors: {}
	}
});

const createFixture = (id: string, data: unknown, configOverrides: Record<string, unknown> = {}): PreviewFixture => ({
	id,
	readySelector: '[data-preview-id="interactive-document-viewer-root"]',
	settleMs: 1400,
	configValues: { ...baseConfig, ...configOverrides },
	dataPickerValues: { documentsData: data },
	datasourceIds: { documentsData: 'preview-document-viewer-table' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} },
	platform: { isDisplayer: true }
});

const longLabelRows: DocumentRow[] = sampleRows.map((row: DocumentRow, index: number): DocumentRow => ({
	...row,
	Name:
		index === 0
			? 'Public Infrastructure Planning Study: Multi-Year Riverway Transit, Pedestrian Safety, and Community Access Recommendations'
			: row.Name,
	Category:
		index < 2 ? 'City Council, Public Hearings, Community Workshops & Archived Meeting Materials' : row.Category,
	Department: index === 0 ? 'Planning, Transportation, Engineering, and Community Development' : 'City Clerk',
	Status: index % 2 === 0 ? 'Published for public review' : 'Final',
	Audience: 'Residents, businesses, boards, commissions, and partner agencies',
	Updated: '2027-06-30'
}));

const categoryNames: string[] = [
	'City Council & Meetings',
	'Public Notices',
	'Budgets & Finance',
	'Plans & Projects',
	'Zoning & Land Use',
	'Building & Permits',
	'Laws & Policies',
	'Elections & Governance',
	'Public Works & Utilities',
	'Parks, Recreation & Community',
	'Public Safety & Emergency Information',
	'Forms & Applications'
];

const maximumRows: DocumentRow[] = Array.from({ length: 48 }, (_value: unknown, index: number): DocumentRow => {
	const source = sampleRows[index % sampleRows.length];
	return {
		...source,
		Name: `${source.Name} — Edition ${String(index + 1).padStart(2, '0')}`,
		Date: `2027-${String((index % 9) + 1).padStart(2, '0')}-${String((index % 24) + 1).padStart(2, '0')}`,
		PDF: source.PDF ? { ...source.PDF, id: `${source.PDF.id}-${index}` } : source.PDF,
		Category: categoryNames[index % categoryNames.length],
		Department: ['City Clerk', 'Finance', 'Public Works', 'Community Development'][index % 4],
		Status: index % 3 === 0 ? 'Draft' : 'Published',
		Audience: index % 2 === 0 ? 'All residents' : 'Applicants and property owners',
		Updated: '2027-07-15'
	};
});

const invalidRows: DocumentRow[] = [
	sampleRows[0],
	{
		...sampleRows[2],
		Name: 'Public Notice: Accessible Route Maintenance Update',
		PDF: null
	},
	{
		...sampleRows[3],
		Name: 'Budget Summary: File Pending Publication',
		PDF: { id: '', name: '', location: '' }
	},
	sampleRows[4]
];

const liveUpdateDatasource = withRows([
	...sampleRows,
	{
		Name: 'Election Notice: 2027 Early Voting Locations',
		Date: '2027-09-14',
		PDF: {
			id: 'sample-pdf-election-notice',
			name: 'early-voting-locations.pdf',
			location: '/preview/pdf-assets/northline-shift-brief.pdf'
		},
		Category: 'Elections & Governance',
		Scheduling: null
	}
]);

const extendedMetadataConfig: Record<string, unknown> = {
	metadataColumn1: 'Date',
	metadataColumn2: 'Department',
	metadataColumn3: 'Status',
	metadataColumn4: 'Audience',
	metadataColumn5: 'Updated',
	metadataColumn6: 'Category'
};

const previewFixture: PreviewFixture = createFixture('interactive-document-viewer-preview', sampleDatasource);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'landscape',
		fixture: previewFixture,
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'landscape-keyboard',
		fixture: createFixture('interactive-document-viewer-landscape-keyboard', sampleDatasource),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Open on-screen keyboard' }],
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'portrait',
		fixture: createFixture('interactive-document-viewer-portrait', sampleDatasource),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 94, height: 94 }
	},
	{
		id: 'portrait-selected',
		fixture: createFixture('interactive-document-viewer-portrait-selected', withRows(maximumRows.slice(0, 12))),
		viewport: { width: 1080, height: 1920, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: maximumRows[0].Name }],
		minimumContentCoverage: { width: 94, height: 94 }
	},
	{
		id: 'custom-branding',
		fixture: createFixture('interactive-document-viewer-custom-branding', sampleDatasource, {
			showEyebrow: true,
			eyebrowText: 'Rivermark information center',
			showAppTitle: true,
			appTitle: 'Community records',
			logoFile: '/src/editor-assets/icon.png',
			directoryIconFile: { filePath: '/src/editor-assets/icon.png' }
		}),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'compact',
		fixture: createFixture('interactive-document-viewer-compact', sampleDatasource),
		viewport: { width: 800, height: 600, background: 'light' },
		minimumContentCoverage: { width: 94, height: 90 }
	},
	{
		id: 'square',
		fixture: createFixture('interactive-document-viewer-square', sampleDatasource),
		viewport: { width: 768, height: 768, background: 'light' },
		minimumContentCoverage: { width: 93, height: 91 }
	},
	{
		id: 'empty',
		fixture: createFixture('interactive-document-viewer-empty', withRows([])),
		viewport: { width: 1080, height: 720, background: 'light' },
		minimumContentCoverage: { width: 94, height: 90 }
	},
	{
		id: 'invalid-rows',
		fixture: createFixture('interactive-document-viewer-invalid', withRows(invalidRows)),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 94, height: 90 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('interactive-document-viewer-long-labels', withRows(longLabelRows), {
			...extendedMetadataConfig,
			appTitle: 'Rivermark Public Records, Plans, Notices & Community Documents'
		}),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 94, height: 94 }
	},
	{
		id: 'maximum-content',
		fixture: createFixture('interactive-document-viewer-maximum', withRows(maximumRows), extendedMetadataConfig),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'screensaver',
		fixture: createFixture('interactive-document-viewer-screensaver', sampleDatasource, { idleSeconds: 15 }),
		viewport: { width: 1080, height: 1920, background: 'dark' },
		advanceTimeMs: 15200,
		minimumContentCoverage: { width: 98, height: 98 }
	},
	{
		id: 'screensaver-branding',
		fixture: createFixture('interactive-document-viewer-screensaver-branding', sampleDatasource, {
			idleSeconds: 15,
			screensaverImage: { filePath: '/src/editor-assets/placeholder.png' },
			screensaverLogoFile: { filePath: '/src/editor-assets/icon.png' },
			screensaverOverlayColor: '#7b2457',
			screensaverSubtext: 'Touch the screen or use the keyboard to continue'
		}),
		viewport: { width: 1080, height: 1920, background: 'dark' },
		advanceTimeMs: 15200,
		minimumContentCoverage: { width: 98, height: 98 }
	},
	{
		id: 'accessibility',
		fixture: createFixture('interactive-document-viewer-accessibility', sampleDatasource, {
			showAccessibilityButton: true
		}),
		viewport: { width: 1920, height: 1080, background: 'light' },
		interactionSteps: [{ type: 'click', role: 'button', name: 'Toggle accessible reach mode' }],
		minimumContentCoverage: { width: 94, height: 92 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('interactive-document-viewer-live-update', sampleDatasource),
		viewport: { width: 1366, height: 768, background: 'light' },
		liveDatasourceUpdate: {
			property: 'documentsData',
			value: liveUpdateDatasource,
			expectedText: 'Election Notice: 2027 Early Voting Locations'
		},
		minimumContentCoverage: { width: 94, height: 90 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'keyboard-text-scale',
		property: 'keyboardTextScale',
		changedValue: 120,
		selector: '[data-preview-id="interactive-document-viewer-root"]',
		measurement: { type: 'attribute', name: 'data-keyboard-text-scale' },
		expectation: { type: 'change' }
	},
	{
		id: 'idle-timeout',
		property: 'idleSeconds',
		changedValue: 180,
		selector: '[data-preview-id="interactive-document-viewer-root"]',
		measurement: { type: 'attribute', name: 'data-idle-seconds' },
		expectation: { type: 'change' }
	},
	{
		id: 'button-color',
		property: 'buttonColor',
		changedValue: '#7b2457',
		selector: '[data-preview-id="interactive-document-viewer-root"]',
		measurement: { type: 'computed-style', property: '--wb-interactive-document-viewer-button' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
