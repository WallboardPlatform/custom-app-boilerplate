import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface CalendarRow extends Record<string, unknown> {
	id: string;
	title?: string;
	summary?: string;
	description?: string;
	location?: string;
	status?: string;
	isAllDay?: boolean;
	start?: Record<string, unknown>;
	end?: Record<string, unknown>;
	startTimestamp?: number;
	endTimestamp?: number;
}

const referenceTime: number = Date.now();
const timestamp = (offsetMinutes: number): number => referenceTime + offsetMinutes * 60000;
const epochSeconds = (offsetMinutes: number): number => Math.floor(timestamp(offsetMinutes) / 1000);
const nestedTime = (offsetMinutes: number): Record<string, string> => ({
	dateTime: new Date(timestamp(offsetMinutes)).toISOString(),
	timeStamp: String(timestamp(offsetMinutes))
});

const imageData =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAADYYG7QAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWklEQVRoge3PQQ0AIBDAsAP/nkEEj4ZkVbC7LUn2rgGg4+7MAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOA2wQ8AATpJXK0AAAAASUVORK5CYII=';

const calendarEvent = (
	id: string,
	title: string,
	startMinutes: number,
	endMinutes: number,
	overrides: Partial<CalendarRow> = {}
): CalendarRow => ({
	id,
	status: 'confirmed',
	title,
	description: 'A public program for visitors moving through the Foundry Arts Center.',
	location: 'North Gallery',
	start: nestedTime(startMinutes),
	end: nestedTime(endMinutes),
	...overrides
});

const iCalendarEvent = (
	id: string,
	summary: string,
	startMinutes: number,
	endMinutes: number,
	overrides: Partial<CalendarRow> = {}
): CalendarRow => ({
	id,
	summary,
	description: 'Imported program details from a civic venue calendar.',
	location: 'Courtyard',
	startTimestamp: timestamp(startMinutes),
	endTimestamp: timestamp(endMinutes),
	...overrides
});

const feedItem = (
	guid: string,
	title: string,
	offsetMinutes: number,
	overrides: Record<string, unknown> = {}
): Record<string, unknown> => ({
	guid,
	title,
	description: '<p>Visitor note for tonight at the Foundry Arts Center.</p>',
	publishDate: epochSeconds(offsetMinutes),
	categories: ['Visitor note'],
	media: { url: imageData },
	...overrides
});

const microsoftCalendar: Record<string, unknown> = {
	events: [
		calendarEvent('program-active', 'Open Studio: Clay and Light', -20, 35, { location: 'Kiln Workshop' }),
		calendarEvent('program-next', 'Courtyard Jazz Before Gallery Hours', 50, 105, { location: 'Foundry Courtyard' }),
		calendarEvent('program-late', 'Print Lab Demonstration', 125, 180, { location: 'Second Floor Studio' })
	]
};

const overlappingCalendar: Record<string, unknown> = {
	events: [
		calendarEvent('overlap-a', 'Foundry Maker Talk', -30, 30, { location: 'North Gallery' }),
		calendarEvent('overlap-b', 'Sound Objects Listening Room', -10, 45, { location: 'Studio 3' }),
		calendarEvent('overlap-next', 'Evening Gallery Walk', 55, 100, { location: 'Main Stair' })
	]
};

const iCalendar: Record<string, unknown> = {
	calendar: {
		events: [
			iCalendarEvent('ical-active', 'Neighborhood Photography Walk', -12, 42),
			iCalendarEvent('ical-next', 'Community Print Exchange', 70, 120)
		]
	}
};

const allDayCalendar: Record<string, unknown> = {
	events: [
		calendarEvent('all-day', 'Foundry Open House and Studio Map', -60, 420, {
			isAllDay: true,
			location: 'All public studios'
		})
	]
};

const longCalendar: Record<string, unknown> = {
	events: [
		calendarEvent(
			'long-program',
			'Intergenerational Workshop for Public Sculpture, Oral History and Shared Civic Memory',
			-15,
			45,
			{
				description:
					'<p>A deliberately long rich-text summary with descenders, punctuation, and enough copy to prove the program surface stays contained.</p>',
				location: ''
			}
		)
	]
};

const updatedCalendar: Record<string, unknown> = {
	events: [
		calendarEvent('program-updated', 'Updated Glass Studio Demonstration', -8, 40, {
			location: 'Glass Annex'
		})
	]
};

const currentFeed: Record<string, unknown> = {
	channel: {
		title: 'Foundry Venue Notes',
		items: [
			feedItem('feed-now', 'Maple Street doors are open for courtyard access', -8),
			feedItem('feed-later', 'Quiet viewing hour begins after the studio program', -60)
		]
	}
};

const legacyFeed: Record<string, unknown> = {
	feed: {
		entries: [
			{
				guid: 'legacy-feed',
				title: 'Workshop check-in has moved beside the bookshop',
				contentSnippet: 'Follow the copper signs near the lobby desk.',
				pubDate: new Date(timestamp(-12)).toISOString(),
				category: 'Arrival',
				enclosure: { url: imageData, type: 'image/png' }
			}
		]
	}
};

const longFeed: Record<string, unknown> = {
	items: [
		feedItem(
			'long-feed',
			'Please use the accessible side entrance during the long-running courtyard sound installation',
			-6,
			{
				description:
					'<strong>Visitor update:</strong> the side entrance remains staffed, signed, and step-free while gallery staff reset the lobby installation.',
				categories: ['Accessibility and visitor route update']
			}
		)
	]
};

const brokenStaleFeed: Record<string, unknown> = {
	items: [
		feedItem('stale-feed', 'Old gallery announcement should not appear', -6000),
		feedItem('broken-media', 'Fresh note appears without broken media', -4, {
			media: { url: 'data:image/png;base64,invalid' }
		})
	]
};

const updatedFeed: Record<string, unknown> = {
	items: [
		feedItem('feed-updated', 'Updated venue note: south stair closes after the talk', -1, {
			media: undefined,
			attachments: []
		})
	]
};

const baseConfig: Record<string, unknown> = {
	venueName: 'Foundry Arts Center',
	boardLabel: 'Today at the Foundry',
	emptyStateText: 'No programs or announcements are scheduled right now.',
	programRotationSeconds: 10,
	announcementFreshHours: 72,
	timeFormat: '12h',
	showMedia: true,
	themePreset: 'light',
	backgroundColor: '#f3efe6',
	surfaceColor: '#fffaf0',
	primaryTextColor: '#1f2421',
	secondaryTextColor: '#606a62',
	accentColor: '#9a4e2f',
	softAccentColor: '#d9b86f'
};

const createFixture = (
	id: string,
	calendarValue: unknown,
	feedValue: unknown,
	configValues: Record<string, unknown> = baseConfig,
	readySelector = '.wb-civic-venue-pulse-program-title'
): PreviewFixture => ({
	id,
	readySelector,
	configValues,
	dataPickerValues: {
		calendarData: calendarValue,
		feedData: feedValue
	},
	datasourceIds: {
		calendarData: 'preview-calendar-data',
		feedData: 'preview-feed-data'
	},
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('foundry-civic-venue-pulse-preview', microsoftCalendar, currentFeed);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'light-theme',
		fixture: createFixture('foundry-light', microsoftCalendar, currentFeed),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 83, height: 56 }
	},
	{
		id: 'dark-theme',
		fixture: createFixture('foundry-dark', microsoftCalendar, currentFeed, { ...baseConfig, themePreset: 'dark' }),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 83, height: 56 }
	},
	{
		id: 'microsoft-calendar-current-feed',
		fixture: createFixture('foundry-microsoft', microsoftCalendar, currentFeed, { ...baseConfig, themePreset: 'custom' }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 83, height: 56 }
	},
	{
		id: 'google-overlap',
		fixture: createFixture('foundry-overlap', overlappingCalendar, currentFeed, {
			...baseConfig,
			programRotationSeconds: 4
		}),
		viewport: { width: 800, height: 480, background: 'light' },
		minimumContentCoverage: { width: 84, height: 57 }
	},
	{
		id: 'icalendar-legacy-feed',
		fixture: createFixture('foundry-ical-legacy', iCalendar, legacyFeed),
		viewport: { width: 800, height: 480, background: 'light' },
		minimumContentCoverage: { width: 84, height: 58 }
	},
	{
		id: 'calendar-only',
		fixture: createFixture('foundry-calendar-only', microsoftCalendar, { items: [] }),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 83, height: 57 }
	},
	{
		id: 'feed-only',
		fixture: createFixture('foundry-feed-only', { events: [] }, currentFeed, baseConfig, '.wb-civic-venue-pulse-announcement-title'),
		viewport: { width: 800, height: 480, background: 'light' },
		minimumContentCoverage: { width: 84, height: 60 }
	},
	{
		id: 'both-empty',
		fixture: createFixture('foundry-empty', { events: [] }, { items: [] }, baseConfig, '.wb-civic-venue-pulse-empty'),
		viewport: { width: 800, height: 480, background: 'light' },
		minimumContentCoverage: { width: 95, height: 88 }
	},
	{
		id: 'long-content',
		fixture: createFixture('foundry-long', longCalendar, longFeed, {
			...baseConfig,
			venueName: 'Foundry Arts Center for Public Craft, Civic Memory and Shared Material Practice',
			boardLabel: 'Today across studios, galleries and courtyard gathering spaces'
		}),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 83, height: 56 }
	},
	{
		id: 'all-day',
		fixture: createFixture('foundry-all-day', allDayCalendar, currentFeed),
		viewport: { width: 800, height: 480, background: 'light' },
		minimumContentCoverage: { width: 84, height: 58 }
	},
	{
		id: 'broken-media-stale-feed',
		fixture: createFixture('foundry-broken-stale', microsoftCalendar, brokenStaleFeed),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 83, height: 56 }
	},
	{
		id: 'live-calendar-update',
		fixture: createFixture('foundry-calendar-update', microsoftCalendar, currentFeed),
		viewport: { width: 800, height: 480, background: 'light' },
		minimumContentCoverage: { width: 84, height: 58 },
		liveDatasourceUpdate: {
			property: 'calendarData',
			value: updatedCalendar,
			expectedText: 'Updated Glass Studio Demonstration'
		}
	},
	{
		id: 'live-feed-update',
		fixture: createFixture('foundry-feed-update', microsoftCalendar, currentFeed),
		viewport: { width: 800, height: 480, background: 'light' },
		minimumContentCoverage: { width: 84, height: 58 },
		liveDatasourceUpdate: {
			property: 'feedData',
			value: updatedFeed,
			expectedText: 'Updated venue note: south stair closes after the talk'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'dark',
		selector: '.wb-civic-venue-pulse',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'media-visibility',
		property: 'showMedia',
		changedValue: false,
		selector: '.wb-civic-venue-pulse',
		scenario: 'microsoft-calendar-current-feed',
		measurement: { type: 'attribute', name: 'data-media-enabled' },
		expectation: { type: 'change' }
	},
	{
		id: 'accent-color',
		property: 'accentColor',
		changedValue: '#276f8f',
		selector: '.wb-civic-venue-pulse',
		scenario: 'microsoft-calendar-current-feed',
		measurement: { type: 'computed-style', property: '--wb-civic-venue-pulse-accent' },
		expectation: { type: 'change' }
	},
	{
		id: 'program-rotation-speed',
		property: 'programRotationSeconds',
		changedValue: 7,
		selector: '.wb-civic-venue-pulse',
		scenario: 'google-overlap',
		measurement: { type: 'attribute', name: 'data-rotation-seconds' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
