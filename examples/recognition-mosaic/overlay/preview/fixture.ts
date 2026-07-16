import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface RecognitionRow extends Record<string, unknown> {
	name: string;
	role: string;
	achievement: string;
	team: string;
	imageUrl: string;
	quote: string;
}

interface RecognitionDatasource {
	Recognitions: {
		header: Record<string, string>;
		rows: RecognitionRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource: RecognitionDatasource = sampleDatasourceJson as RecognitionDatasource;
const portraits: string[] = [
	'/src/assets/portraits/portrait-a.jpg',
	'/src/assets/portraits/portrait-b.jpg',
	'/src/assets/portraits/portrait-c.jpg',
	'/src/assets/portraits/portrait-d.jpg',
	'/src/assets/portraits/portrait-e.jpg'
];
const visualRows: RecognitionRow[] = sampleDatasource.Recognitions.rows.map(
	(row: RecognitionRow, index: number): RecognitionRow => ({
		...row,
		imageUrl: portraits[index % portraits.length] ?? ''
	})
);
const baseConfig: Record<string, unknown> = {
	studioName: 'Paper Kite Studio',
	wallTitle: 'Work worth celebrating',
	emptyStateText: 'Fresh recognition is taking shape.',
	pageDurationSeconds: 3,
	showQuotes: true,
	themePreset: 'light',
	backgroundColor: '#f4f0e8',
	surfaceColor: '#fffaf2',
	textColor: '#18362f',
	mutedTextColor: '#5e6c66',
	accentColor: '#e95545',
	highlightColor: '#f5c84c',
	coolColor: '#2775bd'
};

const withRows = (rows: RecognitionRow[]): RecognitionDatasource => ({
	Recognitions: {
		...sampleDatasource.Recognitions,
		rows
	}
});

const createFixture = (
	id: string,
	data: unknown,
	configOverrides: Record<string, unknown> = {},
	readySelector = '.recognition-card:last-child img:not(.recognition-card__image--loading)'
): PreviewFixture => ({
	id,
	readySelector,
	configValues: { ...baseConfig, ...configOverrides },
	dataPickerValues: { recognitionData: data },
	datasourceIds: { recognitionData: 'preview-recognition-data' },
	additionalConfig: {
		licenseType: null,
		mockDatasource: {},
		style: {}
	}
});

const previewFixture: PreviewFixture = createFixture(
	'paper-kite-recognition-preview',
	withRows(visualRows.slice(0, 5))
);

const brokenPhotoRows: RecognitionRow[] = visualRows.slice(0, 4).map(
	(row: RecognitionRow, index: number): RecognitionRow => ({
		...row,
		imageUrl: index === 0 ? '' : index === 1 ? 'data:image/png;base64,AA==' : row.imageUrl
	})
);
const longCopyRows: RecognitionRow[] = visualRows.slice(0, 4).map(
	(row: RecognitionRow, index: number): RecognitionRow => ({
		...row,
		name: index === 0 ? 'Alexandria Marigold Montgomery-Santos' : row.name,
		role: index === 1 ? 'Principal Multidisciplinary Motion Systems Designer' : row.role,
		team: index === 2 ? 'Research, Strategy and Participatory Futures Studio' : row.team,
		achievement: index === 0
			? 'Coordinated an ambitious cross-studio launch, protected the team from shifting requirements, and still delivered a clear system that every partner could confidently extend.'
			: `${row.achievement} The working notes became a practical guide for the entire studio.`,
		quote: index === 3
			? 'The strongest outcomes appear when careful craft, generous collaboration, and the courage to change direction all stay in the same room.'
			: row.quote
	})
);
const liveEditRows: RecognitionRow[] = visualRows.slice(0, 2).map(
	(row: RecognitionRow, index: number): RecognitionRow => index === 0
		? {
			...row,
			name: 'Maya Rowan-Lee',
			achievement: 'Live edit received: the launch playbook is now shared across every studio team.'
		}
		: row
);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'single-person',
		fixture: createFixture('paper-kite-single-person', withRows(visualRows.slice(0, 1))),
		viewport: { width: 600, height: 600, background: 'light' },
		minimumContentCoverage: { width: 91, height: 85 }
	},
	{
		id: 'two-people',
		fixture: createFixture('paper-kite-two-people', withRows(visualRows.slice(0, 2))),
		viewport: { width: 1536, height: 432, background: 'light' },
		minimumContentCoverage: { width: 92, height: 87 }
	},
	{
		id: 'odd-five',
		fixture: createFixture('paper-kite-odd-five', withRows(visualRows.slice(0, 5))),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 92, height: 88 }
	},
	{
		id: 'prime-seven',
		fixture: createFixture('paper-kite-prime-seven', withRows(visualRows)),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 92, height: 88 }
	},
	{
		id: 'missing-and-broken-photos',
		fixture: createFixture('paper-kite-broken-photos', withRows(brokenPhotoRows)),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 89, height: 86 }
	},
	{
		id: 'long-copy',
		fixture: createFixture('paper-kite-long-copy', withRows(longCopyRows), {
			studioName: 'Paper Kite Creative Studio',
			wallTitle: 'Extraordinary work, seen'
		}),
		viewport: { width: 1536, height: 432, background: 'light' },
		minimumContentCoverage: { width: 92, height: 87 }
	},
	{
		id: 'empty',
		fixture: createFixture(
			'paper-kite-empty',
			withRows([]),
			{},
			'.recognition-empty h2'
		),
		viewport: { width: 600, height: 600, background: 'light' },
		minimumContentCoverage: { width: 84, height: 68 }
	},
	{
		id: 'last-page',
		fixture: createFixture('paper-kite-last-page', withRows(visualRows)),
		viewport: { width: 1920, height: 1080, background: 'light' },
		advanceTimeMs: 3200,
		minimumContentCoverage: { width: 92, height: 88 }
	},
	{
		id: 'live-edit',
		fixture: createFixture('paper-kite-live-edit', withRows(visualRows.slice(0, 2))),
		viewport: { width: 600, height: 600, background: 'light' },
		minimumContentCoverage: { width: 89, height: 84 },
		liveDatasourceUpdate: {
			property: 'recognitionData',
			value: withRows(liveEditRows),
			expectedText: 'Live edit received: the launch playbook is now shared across every studio team.'
		}
	},
	{
		id: 'dark-theme',
		fixture: createFixture('paper-kite-dark-theme', withRows(visualRows.slice(0, 5)), {
			themePreset: 'dark'
		}),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 92, height: 88 }
	},
	{
		id: 'row-array',
		fixture: createFixture('paper-kite-row-array', visualRows.slice(0, 3)),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 92, height: 89 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'dark',
		selector: '.wb-app',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'quote-visibility',
		property: 'showQuotes',
		changedValue: false,
		selector: '.wb-app',
		measurement: { type: 'attribute', name: 'data-show-quotes' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
