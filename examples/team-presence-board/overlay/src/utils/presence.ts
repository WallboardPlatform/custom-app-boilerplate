import { extractArrayAtPaths, isRecord } from '@utils/datasource';

import type { PresenceGroup, PresenceLayout, PresencePerson, PresenceZone } from '@interfaces/presence.interface';

const GROUP_BY_AVAILABILITY: Record<string, PresenceGroup> = {
	available: 'available',
	availableidle: 'available',
	busy: 'busy',
	busyidle: 'busy',
	donotdisturb: 'busy',
	away: 'away',
	berightback: 'away',
	offline: 'offline',
	presenceunknown: 'offline',
	outofoffice: 'offline'
};

const GROUP_LABELS: Record<PresenceGroup, string> = {
	available: 'Available',
	busy: 'Busy',
	away: 'Away',
	offline: 'Offline'
};

const ACTIVITY_LABELS: Record<string, string> = {
	inameeting: 'In a meeting',
	inacall: 'In a call',
	inaconferencecall: 'In a call',
	presenting: 'Presenting',
	offwork: 'Off work',
	donotdisturb: 'Do not disturb',
	berightback: 'Be right back',
	presenceunknown: 'Unknown',
	urgentinterruptionsonly: 'Do not disturb',
	outofoffice: 'Out of office'
};

export const ZONE_ORDER: PresenceGroup[] = ['available', 'busy', 'away', 'offline'];

export const ZONE_TITLES: Record<PresenceGroup, string> = {
	available: 'Available',
	busy: 'Busy / In a meeting',
	away: 'Away',
	offline: 'Offline'
};

export const ZONE_EMPTY_LABELS: Record<PresenceGroup, string> = {
	available: 'Nobody available',
	busy: 'Nobody busy',
	away: 'Nobody away',
	offline: 'Everyone is online'
};

export const INITIALS_HUES: string[] = [
	'#3D6E8F', '#8F5A3D', '#5F8F3D', '#8F3D6E', '#3D8F85', '#6E3D8F',
	'#8F823D', '#3D4A8F', '#8F3D42', '#4A8F3D', '#8F6E3D', '#3D8F5F'
];

const toText = (value: unknown): string => {
	return typeof value === 'string' ? value.trim() : '';
};

const toKey = (mail: string, id: string): string => {
	const localPart: string = mail.includes('@') ? mail.slice(0, mail.indexOf('@')) : mail;

	return (localPart || id).toLowerCase();
};

export const toGroup = (availability: string): PresenceGroup => {
	return GROUP_BY_AVAILABILITY[availability.toLowerCase()] ?? 'offline';
};

export const toLabel = (availability: string, activity: string, group: PresenceGroup): string => {
	const specific: string | undefined = ACTIVITY_LABELS[activity.toLowerCase()];

	if (specific) {
		return specific;
	}

	if (activity && activity.toLowerCase() in GROUP_BY_AVAILABILITY) {
		return GROUP_LABELS[toGroup(activity)];
	}

	return GROUP_LABELS[group];
};

export const normalizePresence = (rawValue: unknown): PresencePerson[] | undefined => {
	const rows: unknown[] | undefined = extractArrayAtPaths(rawValue, [['users'], ['data', 'users']]);

	if (!rows) {
		return undefined;
	}

	const people: PresencePerson[] = [];
	const seenKeys: Record<string, boolean> = {};

	for (const row of rows) {
		if (!isRecord(row)) {
			continue;
		}

		const name: string = toText(row.displayName);
		const givenName: string = toText(row.givenName);

		if (!name || !givenName) {
			continue;
		}

		const mail: string = toText(row.mail);
		const key: string = toKey(mail.toLowerCase(), toText(row.id));

		if (!key || seenKeys[key]) {
			continue;
		}

		seenKeys[key] = true;

		const availability: string = toText(row.availability);
		const group: PresenceGroup = toGroup(availability);
		const photo: string = toText(row.profilePicture);

		people.push({
			key,
			name,
			mail: mail.toLowerCase(),
			dept: toText(row.department),
			photo: /^(https?:|data:)/.test(photo) ? photo : undefined,
			group,
			label: toLabel(availability, toText(row.activity), group),
			rosterIndex: people.length
		});
	}

	return people;
};

export const parseMemberFilter = (memberFilter: string): string[] => {
	return memberFilter
		.split(/[\n,;]+/)
		.map((token: string): string => token.trim().toLowerCase())
		.filter((token: string): boolean => token !== '');
};

export const filterPeople = (
	people: PresencePerson[],
	memberFilter: string,
	requirePhoto: boolean
): PresencePerson[] => {
	const tokens: string[] = parseMemberFilter(memberFilter);

	if (tokens.length > 0) {
		return people.filter((person: PresencePerson): boolean => {
			return tokens.indexOf(person.key) !== -1 || (person.mail !== '' && tokens.indexOf(person.mail) !== -1);
		});
	}

	return requirePhoto
		? people.filter((person: PresencePerson): boolean => Boolean(person.photo))
		: people;
};

export const selectLayout = (count: number): PresenceLayout => {
	if (count <= 1) {
		return 'hero';
	}

	if (count <= 3) {
		return 'compact';
	}

	return count <= 20 ? 'quadrant' : 'dense';
};

export const groupIntoZones = (people: PresencePerson[], showOfflineZone: boolean): PresenceZone[] => {
	const groups: PresenceGroup[] = showOfflineZone
		? ZONE_ORDER
		: ZONE_ORDER.filter((group: PresenceGroup): boolean => group !== 'offline');

	return groups.map((group: PresenceGroup): PresenceZone => ({
		group,
		title: ZONE_TITLES[group],
		emptyLabel: ZONE_EMPTY_LABELS[group],
		people: people.filter((person: PresencePerson): boolean => person.group === group)
	}));
};

export const initials = (name: string): string => {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part: string): string => part.charAt(0).toUpperCase())
		.join('');
};

export const initialsHue = (rosterIndex: number): string => {
	return INITIALS_HUES[((rosterIndex % INITIALS_HUES.length) + INITIALS_HUES.length) % INITIALS_HUES.length];
};

export const formatDuration = (elapsedMs: number): string => {
	const minutes: number = Math.floor(elapsedMs / 60000);

	if (minutes < 1) {
		return 'just now';
	}

	if (minutes < 60) {
		return `${minutes}m`;
	}

	return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export const formatClockTime = (date: Date): string => {
	const rawHours: number = date.getHours();
	const hours: number = rawHours % 12 === 0 ? 12 : rawHours % 12;
	const minutes: string = String(date.getMinutes()).padStart(2, '0');

	return `${String(hours).padStart(2, '0')}:${minutes} ${rawHours < 12 ? 'AM' : 'PM'}`;
};

const WEEKDAYS: string[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS: string[] = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const formatWeekday = (date: Date): string => {
	return WEEKDAYS[date.getDay()];
};

export const formatDate = (date: Date): string => {
	return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

export const formatTickerTime = (date: Date): string => {
	return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
