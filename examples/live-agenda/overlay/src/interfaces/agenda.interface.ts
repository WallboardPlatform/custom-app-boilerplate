export interface AgendaEvent {
	id: string;
	title: string;
	description: string;
	location: string;
	start: number;
	end: number;
	isAllDay: boolean;
}

export type AgendaSource = 'google-or-microsoft' | 'icalendar' | 'unknown';
