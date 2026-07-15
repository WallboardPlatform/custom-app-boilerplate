import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

const fixtureImage = (fileName: string): string => {
	return typeof window === 'undefined'
		? `https://example.invalid/preview/${fileName}`
		: `${window.location.origin}/preview/feed-assets/${fileName}`;
};

const now: number = Date.now();
const epochSeconds = (minutesAgo: number): number => Math.floor((now - minutesAgo * 60000) / 1000);
const isoDate = (minutesAgo: number): string => new Date(now - minutesAgo * 60000).toISOString();
const wallboardItems: Array<Record<string, unknown>> = [
	{
		guid: 'current-1',
		title: 'A quieter language for public technology',
		description: 'Teams are replacing visual noise with clearer systems that respect attention and place.',
		publishDate: epochSeconds(15),
		categories: ['Design'],
		media: { url: fixtureImage('design.png') }
	},
	{
		guid: 'current-2',
		title: 'The station that became a civic room',
		description: 'A transport renovation uses information, light, and local materials to create a calmer daily ritual.',
		publishDate: epochSeconds(60),
		categories: ['Cities'],
		attachments: [{ type: 'image/png', url: fixtureImage('city.png') }]
	},
	{
		guid: 'current-3',
		title: 'Small energy systems, visible impact',
		description: 'A neighbourhood dashboard makes shared energy use understandable without becoming a control panel.',
		publishDate: epochSeconds(120),
		categories: ['Climate'],
		media: { url: fixtureImage('energy.png') }
	},
	{
		guid: 'current-4',
		title: 'Four lessons from a shared studio',
		description: 'Designers and operators compare what survived first contact with a real public space.',
		publishDate: epochSeconds(180),
		categories: ['Practice']
	}
];
const wallboardFeed: Record<string, unknown> = {
	title: 'Field Notes',
	items: wallboardItems
};
const rssParserFeed: Record<string, unknown> = {
	feed: {
		title: 'Field Notes RSS',
		entries: [
			{
				guid: 'legacy-1',
				title: 'The station that became a civic room',
				contentSnippet: 'A transport renovation uses information, light, and local materials.',
				pubDate: isoDate(20),
				categories: ['Cities'],
				enclosure: { url: fixtureImage('city.png'), type: 'image/png' }
			},
			{
				guid: 'legacy-2',
				title: 'Small energy systems, visible impact',
				content: '<p>A neighbourhood dashboard makes shared energy use understandable.</p>',
				pubDate: isoDate(90),
				categories: ['Climate'],
				enclosure: { url: fixtureImage('energy.png'), type: 'image/png' }
			}
		]
	}
};
const rssChannelFeed: Record<string, unknown> = {
	channel: {
		item: [
			{
				guid: 'channel-1',
				title: 'A quieter language for public technology',
				description: '<p>Clearer systems can respect attention and place.</p>',
				pubDate: isoDate(12),
				category: 'Design',
				media: { url: fixtureImage('design.png') }
			},
			{
				guid: 'channel-2',
				title: 'Four lessons from a shared studio',
				description: 'What survived first contact with a real public space.',
				pubDate: isoDate(75),
				category: 'Practice'
			}
		]
	}
};
const brokenMediaFeed: Record<string, unknown> = {
	items: [{ ...wallboardItems[0], guid: 'broken-1', media: { url: 'data:image/png;base64,invalid' } }]
};
const longLabelFeed: Record<string, unknown> = {
	items: [
		{
			...wallboardItems[0],
			guid: 'long-1',
			title: 'How collaborative public-service teams are building resilient information systems for complex shared environments',
			description: 'A deliberately long editorial description demonstrates how the layout contains meaningful supporting copy while preserving the featured media, category, publication date, and the surrounding story rail.',
			categories: ['Public-interest technology and inclusive information design']
		},
		...wallboardItems.slice(1)
	]
};
const updatedFeed: Record<string, unknown> = {
	items: [
		{
			...wallboardItems[2],
			guid: 'updated-1',
			title: 'Updated newsroom lead story',
			publishDate: epochSeconds(1),
			media: undefined,
			attachments: []
		},
		...wallboardItems.slice(0, 3)
	]
};

const baseConfig: Record<string, unknown> = {
	sourceLabel: 'Field notes',
	emptyStateText: 'No stories are available.',
	rotationSeconds: 8,
	maxStories: 6,
	showDescription: true,
	showTimestamp: true,
	imagePosition: 'left',
	backgroundColor: '#f2efe8',
	panelColor: '#17211f',
	primaryTextColor: '#f9f7f0',
	secondaryTextColor: '#b9c4bf',
	accentColor: '#ef5b45'
};

const createFixture = (
	id: string,
	value: unknown,
	configValues: Record<string, unknown> = baseConfig,
	readySelector = '.story-title'
): PreviewFixture => ({
	id,
	readySelector,
	configValues,
	dataPickerValues: { feedData: value },
	datasourceIds: { feedData: 'preview-feed-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('newsroom-spotlight-preview', wallboardFeed);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'wallboard-feed',
		fixture: createFixture('newsroom-wallboard-feed', wallboardFeed),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 90, height: 86 }
	},
	{
		id: 'rss-parser',
		fixture: createFixture('newsroom-rss-parser', rssParserFeed),
		viewport: { width: 1536, height: 432, background: 'light' },
		minimumContentCoverage: { width: 92, height: 84 }
	},
	{
		id: 'rss-channel',
		fixture: createFixture('newsroom-rss-channel', rssChannelFeed),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 88, height: 84 }
	},
	{
		id: 'empty',
		fixture: createFixture('newsroom-empty', { items: [] }, baseConfig, '.feed-empty'),
		viewport: { width: 600, height: 600, background: 'light' },
		minimumContentCoverage: { width: 88, height: 85 }
	},
	{
		id: 'broken-media',
		fixture: createFixture('newsroom-broken-media', brokenMediaFeed, baseConfig, '.story-media-fallback'),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 90, height: 80 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('newsroom-long-labels', longLabelFeed, {
			...baseConfig,
			sourceLabel: 'Independent field notes on cities, climate and shared public technology'
		}),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 88, height: 88 }
	},
	{
		id: 'rotation',
		fixture: createFixture('newsroom-rotation', wallboardFeed, { ...baseConfig, rotationSeconds: 2 }),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 90, height: 85 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('newsroom-live-update', wallboardFeed),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 90, height: 85 },
		liveDatasourceUpdate: {
			property: 'feedData',
			value: updatedFeed,
			expectedText: 'Updated newsroom lead story'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'description-visibility',
		property: 'showDescription',
		changedValue: false,
		selector: '.wb-app',
		scenario: 'wallboard-feed',
		measurement: { type: 'attribute', name: 'data-show-description' },
		expectation: { type: 'change' }
	},
	{
		id: 'image-position',
		property: 'imagePosition',
		changedValue: 'right',
		selector: '.wb-app',
		scenario: 'wallboard-feed',
		measurement: { type: 'attribute', name: 'data-image-position' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
