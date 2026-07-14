import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';


interface SampleDatasourceBundle extends Record<string, unknown> {
	nasdaq100: Record<string, unknown>;
	tsx60: Record<string, unknown>;
	dj30: Record<string, unknown>;
	fx: Record<string, unknown>;
	stockIcons: Record<string, unknown>;
}

const sampleDatasource: SampleDatasourceBundle = sampleDatasourceJson as SampleDatasourceBundle;
const defaultFont = (size: number): Record<string, string | number> => ({
	'font-family': 'Arial Narrow, Arial, sans-serif',
	'font-size': size,
	'font-style': 'normal',
	'font-weight': 800,
	color: '#ffffff',
	'text-decoration': 'none'
});
const baseConfig: Record<string, unknown> = {
	nasdaqLabel: 'NASDAQ 100',
	tsxLabel: 'TSX60: TORONTO STOCK EXCHANGE',
	dowLabel: 'DJ30: DOW JONES',
	fxLabel: 'CAD AND USD FX',
	exchangeTitleSeconds: 1,
	speedPixelsPerSecond: 1400,
	verticalMargin: 4,
	itemMargin: 22,
	logoScale: 72,
	marketLabelFont: defaultFont(28),
	tickerFont: defaultFont(34),
	priceFont: defaultFont(28),
	changeFont: defaultFont(21),
	backgroundColor: '#000000',
	exchangeTitleColor: '#ff1f2d',
	upColor: '#4fe34f',
	downColor: '#ff2435',
	fallbackIconBackground: '#20252b',
	emptyStateText: 'No valid market data is available.'
};
const allDatasourceIds: Record<string, string> = {
	nasdaqData: 'preview-nasdaq100',
	tsxData: 'preview-tsx60',
	dowData: 'preview-dj30',
	fxData: 'preview-fx',
	stockIcons: 'preview-stock-icons'
};

const datasourceIdsFor = (dataPickerValues: Record<string, unknown>): Record<string, string> => {
	const datasourceIds: Record<string, string> = {};

	for (const key of Object.keys(dataPickerValues)) {
		datasourceIds[key] = allDatasourceIds[key] ?? `preview-${key}`;
	}

	return datasourceIds;
};

const createFixture = (
	id: string,
	dataPickerValues: Record<string, unknown>,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.exchange-title strong',
	configValues,
	dataPickerValues,
	datasourceIds: datasourceIdsFor(dataPickerValues),
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const limitedApiDatasource = (source: Record<string, unknown>, limit: number): Record<string, unknown> => ({
	...source,
	response: Array.isArray(source.response) ? source.response.slice(0, limit) : []
});
const limitedTsxDatasource = (limit: number): Record<string, unknown> => {
	const feed: Record<string, unknown> = sampleDatasource.tsx60.feed as Record<string, unknown>;

	return {
		...sampleDatasource.tsx60,
		feed: {
			...feed,
			entry: Array.isArray(feed.entry) ? feed.entry.slice(0, limit) : []
		}
	};
};
const compactDatasourceValues: Record<string, unknown> = {
	nasdaqData: limitedApiDatasource(sampleDatasource.nasdaq100, 3),
	tsxData: limitedTsxDatasource(3),
	dowData: limitedApiDatasource(sampleDatasource.dj30, 3),
	fxData: sampleDatasource.fx,
	stockIcons: sampleDatasource.stockIcons
};
const previewDatasourceValues: Record<string, unknown> = {
	nasdaqData: limitedApiDatasource(sampleDatasource.nasdaq100, 16),
	tsxData: limitedTsxDatasource(16),
	dowData: limitedApiDatasource(sampleDatasource.dj30, 16),
	fxData: sampleDatasource.fx,
	stockIcons: sampleDatasource.stockIcons
};
const invalidNasdaqDatasource: Record<string, unknown> = {
	...sampleDatasource.nasdaq100,
	response: [
		{ s: 'INVALID', c: '#N/A', ch: '+1.00', id: 'invalid-1' },
		{ s: '', c: '12.00', ch: '-0.20', id: 'invalid-2' }
	]
};

const previewFixture: PreviewFixture = createFixture('market-rotation-ticker-preview', previewDatasourceValues);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'scrolling-nasdaq',
		fixture: {
			...createFixture('market-rotation-ticker-scrolling', previewDatasourceValues),
			readySelector: '.stock-item'
		},
		viewport: { width: 6000, height: 136, background: 'dark' },
		advanceTimeMs: 1450,
		minimumContentCoverage: { width: 95, height: 60 }
	},
	{
		id: 'market-rotation',
		fixture: {
			...createFixture(
				'market-rotation-ticker-next-market',
				compactDatasourceValues,
				{ ...baseConfig, speedPixelsPerSecond: 4000 }
			),
			readySelector: '.wb-app[data-market="tsx60"][data-phase="title"] .exchange-title strong'
		},
		viewport: { width: 1536, height: 136, background: 'dark' },
		advanceTimeMs: 2600,
		minimumContentCoverage: { width: 90, height: 15 }
	},
	{
		id: 'short-fx-dataset',
		fixture: {
			...createFixture('market-rotation-ticker-fx', {
				fxData: sampleDatasource.fx,
				stockIcons: sampleDatasource.stockIcons
			}),
			readySelector: '.stock-item'
		},
		viewport: { width: 6000, height: 136, background: 'dark' },
		advanceTimeMs: 1450,
		minimumContentCoverage: { width: 95, height: 40 }
	},
	{
		id: 'missing-icons',
		fixture: {
			...createFixture('market-rotation-ticker-missing-icons', {
				nasdaqData: limitedApiDatasource(sampleDatasource.nasdaq100, 8),
				stockIcons: { totalSize: 0, size: 0, content: [] }
			}),
			readySelector: '.stock-logo-fallback'
		},
		viewport: { width: 1920, height: 180, background: 'dark' },
		advanceTimeMs: 1450,
		minimumContentCoverage: { width: 90, height: 60 }
	},
	{
		id: 'invalid-prices',
		fixture: {
			...createFixture('market-rotation-ticker-invalid', {
				nasdaqData: invalidNasdaqDatasource,
				stockIcons: sampleDatasource.stockIcons
			}),
			readySelector: '.ticker-empty'
		},
		viewport: { width: 1536, height: 180, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 10 }
	},
	{
		id: 'unbound',
		fixture: {
			...createFixture('market-rotation-ticker-unbound', {}),
			readySelector: '.ticker-empty'
		},
		viewport: { width: 1280, height: 180, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 10 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'vertical-margin',
		property: 'verticalMargin',
		changedValue: 24,
		selector: '.ticker-viewport',
		scenario: 'scrolling-nasdaq',
		measurement: { type: 'computed-style', property: 'padding-top' },
		expectation: { type: 'increase', minimumDelta: 15 }
	},
	{
		id: 'item-margin',
		property: 'itemMargin',
		changedValue: 60,
		selector: '.stock-item',
		scenario: 'scrolling-nasdaq',
		measurement: { type: 'bounding-box', dimension: 'width' },
		expectation: { type: 'increase', minimumDelta: 50 }
	},
	{
		id: 'logo-scale',
		property: 'logoScale',
		changedValue: 100,
		selector: '.stock-logo-image',
		scenario: 'scrolling-nasdaq',
		measurement: { type: 'bounding-box', dimension: 'height' },
		expectation: { type: 'increase', minimumDelta: 15 }
	},
	{
		id: 'market-label-font',
		property: 'marketLabelFont',
		changedValue: defaultFont(52),
		selector: '.exchange-title strong',
		measurement: { type: 'computed-style', property: 'font-size' },
		expectation: { type: 'increase', minimumDelta: 20 }
	}
];

export default previewFixture;
