export interface VenueProgram {
	id: string;
	title: string;
	summary: string;
	location: string;
	start: number;
	end: number;
	isAllDay: boolean;
}

export type CalendarSource = 'google-or-microsoft' | 'icalendar' | 'array' | 'unknown';

export interface CalendarModel {
	programs: VenueProgram[];
	source: CalendarSource;
}

export interface VenueAnnouncement {
	id: string;
	title: string;
	summary: string;
	category: string;
	imageUrl: string;
	publishedAt?: number;
}

export type FeedSource = 'wallboard-feed' | 'rss-parser' | 'rss-channel' | 'array' | 'unknown';

export interface FeedModel {
	announcements: VenueAnnouncement[];
	source: FeedSource;
}
