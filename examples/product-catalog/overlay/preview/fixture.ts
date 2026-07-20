import sampleDatasourceJson from '../sample-products-table-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface ProductRow extends Record<string, unknown> {
	sku: string;
	name: string;
	category: string;
	description: string;
	price: string;
	badge: string;
	availability: string;
	detailOne: string;
	detailTwo: string;
	image: { id: string; location: string; name: string };
	sortOrder: number;
}

interface ProductsDatasource {
	Products: {
		header: Record<string, string>;
		rows: ProductRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource = sampleDatasourceJson as ProductsDatasource;
const baseConfig: Record<string, unknown> = {
	brandLabel: 'FIELD NOTE / OBJECTS FOR EVERYDAY',
	collectionTitle: 'Useful things, considered.',
	emptyStateText: 'The next collection is being prepared.',
	pageDurationSeconds: 30,
	motionPreset: 'subtle',
	mediaFit: 'cover',
	backgroundColor: '#f3efdf',
	textColor: '#112d2a',
	mutedTextColor: '#5a6964',
	accentColor: '#ef4b3e',
	panelColor: '#d6e5dd'
};
const withRows = (rows: ProductRow[]): ProductsDatasource => ({
	Products: {
		...sampleDatasource.Products,
		rows
	}
});

const createFixture = (
	id: string,
	rows: ProductRow[],
	configOverrides: Record<string, unknown> = {},
	readySelector = '.wb-product-catalog-stage'
): PreviewFixture => ({
	id,
	readySelector,
	configValues: { ...baseConfig, ...configOverrides },
	dataPickerValues: { products: withRows(rows) },
	datasourceIds: { products: 'preview-products-table' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewImageLocations: Record<string, string> = {
	'FN-101': '/preview/catalog-assets/arc-lamp.jpg',
	'FN-204': '/preview/catalog-assets/pulse-speaker.jpg',
	'FN-308': '/preview/catalog-assets/pour-over-set.jpg',
	'FN-412': '/preview/catalog-assets/weekender-bag.jpg'
};
const rows: ProductRow[] = sampleDatasource.Products.rows.map((row): ProductRow => ({
	...row,
	image: { ...row.image, location: previewImageLocations[row.sku] ?? '' }
}));
const longRows: ProductRow[] = rows.map((row, index): ProductRow => index === 0 ? {
	...row,
	name: 'Arc Portable Ambient Table and Terrace Lamp',
	description: 'A rechargeable pool of warm light designed for long dinners, bedside reading, sheltered terraces, and every in-between corner that deserves a calmer atmosphere.'
} : row);
const liveRows: ProductRow[] = rows.map((row, index): ProductRow => index === 0 ? {
	...row,
	name: 'Arc Portable Lamp / Summer Blue',
	price: '$119'
} : row);

const previewFixture: PreviewFixture = createFixture('field-note-catalog-preview', rows);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'portrait-catalog',
		fixture: createFixture('field-note-catalog-portrait', rows),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 89, height: 91 }
	},
	{
		id: 'wide-low',
		fixture: createFixture('field-note-catalog-wide', rows),
		viewport: { width: 1536, height: 432, background: 'light' },
		minimumContentCoverage: { width: 94, height: 82 }
	},
	{
		id: 'compact',
		fixture: createFixture('field-note-catalog-compact', rows),
		viewport: { width: 600, height: 600, background: 'light' },
		minimumContentCoverage: { width: 91, height: 87 }
	},
	{
		id: 'long-copy',
		fixture: createFixture('field-note-catalog-long-copy', longRows, {
			collectionTitle: 'Objects for rooms, roads, rituals, and unhurried weekends',
			pageDurationSeconds: 30
		}),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 92, height: 83 }
	},
	{
		id: 'missing-image',
		fixture: {
			...createFixture('field-note-catalog-missing-image', rows.map((row, index): ProductRow => index === 0 ? {
				...row,
				image: { name: '', id: '', location: '' }
			} : row), { pageDurationSeconds: 30 }),
			settleMs: 1000
		},
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 92, height: 83 }
	},
	{
		id: 'empty',
		fixture: createFixture('field-note-catalog-empty', [], {}, '.wb-product-catalog-empty h2'),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 70, height: 53 }
	},
	{
		id: 'last-product',
		fixture: createFixture('field-note-catalog-last-product', rows, { pageDurationSeconds: 3 }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		advanceTimeMs: 9200,
		minimumContentCoverage: { width: 92, height: 83 }
	},
	{
		id: 'live-product-update',
		fixture: createFixture('field-note-catalog-live-product', rows),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 92, height: 83 },
		liveDatasourceUpdate: {
			property: 'products',
			value: withRows(liveRows),
			expectedText: 'Arc Portable Lamp / Summer Blue'
		}
	},
	{
		id: 'motion-off',
		fixture: createFixture('field-note-catalog-motion-off', rows, { motionPreset: 'off' }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 92, height: 83 }
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'background-color',
		property: 'backgroundColor',
		changedValue: '#dbe7f0',
		selector: '.wb-product-catalog-root',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'motion-preset',
		property: 'motionPreset',
		changedValue: 'expressive',
		selector: '.wb-product-catalog-root',
		measurement: { type: 'attribute', name: 'data-motion-preset' },
		expectation: { type: 'change' }
	},
	{
		id: 'media-fit',
		property: 'mediaFit',
		changedValue: 'contain',
		selector: '.wb-product-catalog-media img',
		measurement: { type: 'computed-style', property: 'object-fit' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
