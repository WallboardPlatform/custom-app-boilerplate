import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface OfferRow extends Record<string, unknown> {
	eyebrow: string;
	headline: string;
	price: string;
	priceNote: string;
	validUntil: string;
	smallPrint: string;
}

interface OfferDatasource {
	Offers: {
		header: Record<string, string>;
		rows: OfferRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource = sampleDatasourceJson as OfferDatasource;

export const sampleOffers: OfferRow[] = sampleDatasource.Offers.rows;

export const withRows = (rows: readonly OfferRow[]): OfferDatasource => ({
	Offers: { ...sampleDatasource.Offers, rows: [...rows] }
});

const baseConfig: Record<string, unknown> = {
	brandName: 'Fernbrook Market',
	canvasColor: '#0f2a24',
	inkColor: '#f6f1e4',
	accentColor: '#e4a03c',
	letterboxColor: '#07100e',
	rotationSeconds: 12,
	showValidity: true,
	emptyStateText: 'No offer is scheduled right now.'
};

const createFixture = (
	id: string,
	value: unknown = sampleDatasource,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.wb-offer-poster-canvas',
	configValues,
	dataPickerValues: { offerData: value },
	datasourceIds: { offerData: 'preview-offer-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('seasonal-offer-poster-preview');

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'single-offer',
		fixture: createFixture('seasonal-offer-poster-single', withRows(sampleOffers.slice(0, 1))),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 92, height: 88 }
	},
	{
		/*
		 * The archetype's whole claim, on the surface that tests it hardest. A square surface has to
		 * letterbox top and bottom, and the poster must arrive intact rather than rearranged.
		 */
		id: 'square-letterbox',
		fixture: createFixture('seasonal-offer-poster-square'),
		viewport: { width: 900, height: 900, background: 'dark' },
		minimumContentCoverage: { width: 92, height: 54 }
	},
	{
		id: 'portrait-letterbox',
		fixture: createFixture('seasonal-offer-poster-portrait'),
		viewport: { width: 1080, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 92, height: 30 }
	},
	{
		id: 'ultra-wide-letterbox',
		fixture: createFixture('seasonal-offer-poster-ultra-wide'),
		viewport: { width: 1920, height: 540, background: 'light' },
		minimumContentCoverage: { width: 48, height: 88 }
	},
	{
		id: 'long-copy',
		fixture: createFixture('seasonal-offer-poster-long-copy', withRows([
			{
				eyebrow: 'Extended seasonal promotion across every participating market hall',
				headline: 'Stone-baked sourdough,  seasonal fruit crates  and cold-pressed juice',
				price: '£12',
				priceNote: 'for the full seasonal bundle',
				validUntil: 'Valid until the final Sunday of the season',
				smallPrint: 'While stocks last, one bundle per customer per visit, selected stores only, excludes imported citrus and any item already reduced.'
			}
		])),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 92, height: 88 }
	},
	{
		id: 'no-price',
		fixture: createFixture('seasonal-offer-poster-no-price', withRows([
			{
				eyebrow: 'Every Thursday',
				headline: 'Growers market  in the courtyard',
				price: '',
				priceNote: '',
				validUntil: 'From 8am until sold out',
				smallPrint: 'Stallholders vary each week.'
			}
		])),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 88, height: 80 }
	},
	{
		id: 'empty',
		fixture: createFixture('seasonal-offer-poster-empty', withRows([])),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 78, height: 60 }
	},
	{
		id: 'custom-brand',
		fixture: createFixture('seasonal-offer-poster-custom-brand', sampleDatasource, {
			...baseConfig,
			brandName: 'Harbour Provisions',
			canvasColor: '#1b1d2b',
			inkColor: '#f2f4ff',
			accentColor: '#7ea6ff',
			letterboxColor: '#0a0b12'
		}),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 92, height: 88 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('seasonal-offer-poster-live'),
		viewport: { width: 1920, height: 1080, background: 'checker' },
		minimumContentCoverage: { width: 92, height: 88 },
		liveDatasourceUpdate: {
			property: 'offerData',
			value: withRows([
				{
					eyebrow: 'Just added',
					headline: 'Late harvest  preserves',
					price: '£4',
					priceNote: 'per jar',
					validUntil: 'Until the end of the month',
					smallPrint: 'Made in small batches at the market kitchen.'
				}
			]),
			expectedText: 'Late harvest'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'surround-colour',
		property: 'letterboxColor',
		changedValue: '#4b1d1d',
		scenario: 'square-letterbox',
		selector: '[data-preview-id="offer-poster-root"]',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'validity-visibility',
		property: 'showValidity',
		changedValue: false,
		selector: '[data-preview-id="offer-canvas"]',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
