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
const nestedTime = (offsetMinutes: number): Record<string, string> => ({
	dateTime: new Date(timestamp(offsetMinutes)).toISOString(),
	timeStamp: String(timestamp(offsetMinutes))
});
const googleOrMicrosoftEvent = (
	id: string,
	title: string,
	startMinutes: number,
	endMinutes: number,
	overrides: Partial<CalendarRow> = {}
): CalendarRow => ({
	id,
	status: 'confirmed',
	title,
	description: 'A practical session for teams building clearer shared experiences.',
	location: 'Forum stage',
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
	description: 'Imported from an iCalendar programme feed.',
	location: 'Studio B',
	startTimestamp: timestamp(startMinutes),
	endTimestamp: timestamp(endMinutes),
	...overrides
});

const microsoftCalendar: Record<string, unknown> = {
	events: [
		googleOrMicrosoftEvent('active', 'Designing calm public information', -20, 25),
		googleOrMicrosoftEvent('next-1', 'Operational storytelling', 40, 85, { location: 'Studio B' }),
		googleOrMicrosoftEvent('next-2', 'Lunch and product demos', 105, 180, { location: 'Atrium' }),
		googleOrMicrosoftEvent('next-3', 'Accessible signage systems', 210, 255, { location: 'Forum stage' }),
		googleOrMicrosoftEvent('cancelled', 'Cancelled session', 270, 300, { status: 'cancelled' })
	]
};
const iCalendar: Record<string, unknown> = {
	calendar: {
		events: [
			iCalendarEvent('ical-active', 'Live systems briefing', -15, 30),
			iCalendarEvent('ical-next-1', 'Audience-first content design', 55, 100),
			iCalendarEvent('ical-next-2', 'Closing conversation', 130, 175, { location: 'Main theatre' })
		]
	}
};
const longLabelCalendar: Record<string, unknown> = {
	events: [
		googleOrMicrosoftEvent(
			'long-active',
			'Designing accessible, resilient and context-aware information systems for complex public environments',
			-20,
			25,
			{
				description: 'A deliberately long supporting description that proves the featured card contains editorial copy without colliding with the venue or progress treatment.',
				location: 'International collaboration and demonstration auditorium, north entrance'
			}
		),
		googleOrMicrosoftEvent('long-next-1', 'A second representative programme item with a long descriptive title', 40, 90, {
			location: 'Multi-purpose workshop and broadcast room'
		}),
		googleOrMicrosoftEvent('long-next-2', 'Inclusive information architecture roundtable', 110, 165, {
			location: 'International collaboration lounge'
		}),
		googleOrMicrosoftEvent('long-next-3', 'Closing observations and audience questions', 185, 230, {
			location: 'Main auditorium'
		})
	]
};
const allDayCalendar: Record<string, unknown> = {
	events: [
		googleOrMicrosoftEvent('all-day', 'Open studio and exhibition', 30, 600, { isAllDay: true }),
		googleOrMicrosoftEvent('all-day-next-1', 'Guided exhibition walk', 660, 705, { location: 'Gallery entrance' }),
		googleOrMicrosoftEvent('all-day-next-2', 'Evening reception', 750, 840, { location: 'Atrium' })
	]
};
const updatedCalendar: Record<string, unknown> = {
	events: [
		googleOrMicrosoftEvent('active-update', 'Updated studio session', -10, 35, { location: 'Studio C' }),
		googleOrMicrosoftEvent('next-update-1', 'Updated closing programme', 50, 90),
		googleOrMicrosoftEvent('next-update-2', 'Updated networking break', 110, 145, { location: 'Atrium' }),
		googleOrMicrosoftEvent('next-update-3', 'Updated evening briefing', 170, 215, { location: 'Forum stage' })
	]
};

const baseConfig: Record<string, unknown> = {
	venueName: 'North Hall',
	boardTitle: 'Today at the forum',
	upcomingTitle: 'Coming up',
	emptyStateText: 'No more events are scheduled.',
	maxUpcoming: 4,
	timeFormat: '24h',
	showClock: true,
	themePreset: 'dark',
	backgroundColor: '#101313',
	panelColor: '#1b2020',
	primaryTextColor: '#f5f2e9',
	secondaryTextColor: '#aeb8b4',
	accentColor: '#64e3bd',
	liveColor: '#ff6b5f'
};

const createFixture = (
	id: string,
	value: unknown,
	configValues: Record<string, unknown> = baseConfig,
	readySelector = '.featured-title'
): PreviewFixture => ({
	id,
	readySelector,
	configValues,
	dataPickerValues: { calendarData: value },
	datasourceIds: { calendarData: 'preview-calendar-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('live-agenda-preview', microsoftCalendar);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'light-theme',
		fixture: createFixture('live-agenda-light-theme', microsoftCalendar, { ...baseConfig, themePreset: 'light' }),
		viewport: { width: 1280, height: 720, background: 'light' },
		minimumContentCoverage: { width: 80, height: 75 }
	},
	{
		id: 'microsoft-calendar',
		fixture: createFixture('live-agenda-microsoft', microsoftCalendar, { ...baseConfig, themePreset: 'custom' }),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 75 }
	},
	{
		id: 'icalendar',
		fixture: createFixture('live-agenda-icalendar', iCalendar),
		viewport: { width: 1536, height: 432, background: 'dark' },
		minimumContentCoverage: { width: 90, height: 82 }
	},
	{
		id: 'empty',
		fixture: createFixture('live-agenda-empty', { events: [] }, baseConfig, '.agenda-empty'),
		viewport: { width: 600, height: 600, background: 'dark' },
		minimumContentCoverage: { width: 85, height: 85 }
	},
	{
		id: 'long-labels',
		fixture: createFixture('live-agenda-long-labels', longLabelCalendar, {
			...baseConfig,
			venueName: 'International Centre for Shared Information and Public Experience',
			boardTitle: 'Today across the public innovation and collaboration forum',
			upcomingTitle: 'Upcoming programme and scheduled sessions'
		}),
		viewport: { width: 1080, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 85, height: 85 }
	},
	{
		id: 'all-day',
		fixture: createFixture('live-agenda-all-day', allDayCalendar),
		viewport: { width: 600, height: 600, background: 'dark' },
		minimumContentCoverage: { width: 85, height: 85 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('live-agenda-update', microsoftCalendar),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 88, height: 75 },
		liveDatasourceUpdate: {
			property: 'calendarData',
			value: updatedCalendar,
			expectedText: 'Updated studio session'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '.wb-app',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'clock-visibility',
		property: 'showClock',
		changedValue: false,
		selector: '.wb-app',
		scenario: 'microsoft-calendar',
		measurement: { type: 'attribute', name: 'data-show-clock' },
		expectation: { type: 'change' }
	},
	{
		id: 'accent-color',
		property: 'accentColor',
		changedValue: '#ffd166',
		selector: '.wb-app',
		scenario: 'microsoft-calendar',
		measurement: { type: 'computed-style', property: '--agenda-accent' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
