export type PresenceGroup = 'available' | 'busy' | 'away' | 'offline';

export interface PresencePerson {
	key: string;
	name: string;
	mail: string;
	dept: string;
	photo?: string;
	group: PresenceGroup;
	label: string;
	rosterIndex: number;
}

export type PresenceLayout = 'dense' | 'quadrant' | 'compact' | 'hero';

export interface PresenceZone {
	group: PresenceGroup;
	title: string;
	emptyLabel: string;
	people: PresencePerson[];
}

export interface StatusChange {
	key: string;
	name: string;
	label: string;
	at: number;
}
