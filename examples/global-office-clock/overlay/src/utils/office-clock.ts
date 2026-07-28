import type { Office, OfficeOpenState, OfficeReading } from '@interfaces/office-clock.interface';

interface RawRow extends Record<string, unknown> {
	closesAtHour?: unknown;
	name?: unknown;
	opensAtHour?: unknown;
	region?: unknown;
	timeZone?: unknown;
}

const text = (value: unknown, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const hour = (value: unknown, fallback: number): number => {
	const parsed: number = Number(value);

	return Number.isFinite(parsed) ? Math.min(24, Math.max(0, Math.round(parsed))) : fallback;
};

/**
 * A zone is only usable if the platform can actually format with it. An unrecognised zone would
 * otherwise throw inside the render and take the whole board down, so it is resolved once here
 * and the column states the fallback instead.
 */
export const isResolvableTimeZone = (timeZone: string): boolean => {
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone }).format(new Date(0));

		return true;
	} catch {
		return false;
	}
};

const rowsOf = (value: unknown): RawRow[] => {
	if (Array.isArray(value)) return value as RawRow[];

	if (value && typeof value === 'object') {
		const container = value as Record<string, { rows?: unknown }>;

		for (const entry of Object.values(container)) {
			if (entry && Array.isArray(entry.rows)) return entry.rows as RawRow[];
		}
	}

	return [];
};

export const normalizeOffices = (value: unknown): Office[] => {
	return rowsOf(value).map((row: RawRow, index: number): Office => {
		const timeZone: string = text(row.timeZone, '');
		const zoneResolved: boolean = timeZone !== '' && isResolvableTimeZone(timeZone);

		return {
			id: `${text(row.name, 'office')}-${index}`,
			name: text(row.name, `Office ${index + 1}`),
			region: text(row.region, ''),
			timeZone: zoneResolved ? timeZone : 'UTC',
			opensAtHour: hour(row.opensAtHour, 9),
			closesAtHour: hour(row.closesAtHour, 17),
			zoneResolved
		};
	});
};

const partsFor = (office: Office, at: Date): Intl.DateTimeFormatPart[] => {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone: office.timeZone,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	}).formatToParts(at);
};

export const localHour = (office: Office, at: Date): number => {
	const part = partsFor(office, at).find((candidate): boolean => candidate.type === 'hour');

	return Number.parseInt(part?.value ?? '0', 10);
};

/**
 * Working hours are read in the office's own local time, and a window that crosses midnight is
 * treated as wrapping rather than as an empty range.
 */
export const openStateOf = (office: Office, at: Date): OfficeOpenState => {
	if (!office.zoneResolved) return 'unknown';

	const current: number = localHour(office, at);

	if (office.opensAtHour === office.closesAtHour) return 'open';

	return office.opensAtHour < office.closesAtHour
		? (current >= office.opensAtHour && current < office.closesAtHour ? 'open' : 'closed')
		: (current >= office.opensAtHour || current < office.closesAtHour ? 'open' : 'closed');
};

/**
 * Hours ahead of or behind the first office. A distributed team reads the board to answer "can I
 * call them now", and that is a difference, not an absolute. The first row is home rather than
 * the player's own zone so the board renders identically wherever it is previewed.
 */
export const offsetFromHome = (home: Office, office: Office, at: Date): number => {
	const read = (zone: string): number => {
		const parts: string = new Intl.DateTimeFormat('en-GB', {
			timeZone: zone,
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		}).format(at);
		const [day, clock] = parts.split(', ');
		const [hours, minutes] = (clock ?? '00:00').split(':');

		return Number(day) * 1440 + Number(hours) * 60 + Number(minutes);
	};
	const difference: number = read(office.timeZone) - read(home.timeZone);
	// A day boundary between the two zones shows up as a ~24h jump; fold it back.
	const folded: number = difference > 720 ? difference - 1440 : difference < -720 ? difference + 1440 : difference;

	return Math.round(folded / 60);
};

export const offsetLabel = (hours: number): string => {
	if (hours === 0) return 'Same time';

	return `${hours > 0 ? '+' : '−'}${Math.abs(hours)}h`;
};

/** The office's own working window, so a viewer can see why it reads open or closed. */
export const hoursLabel = (office: Office): string => {
	const pad = (value: number): string => String(value).padStart(2, '0');

	return `${pad(office.opensAtHour)}:00 – ${pad(office.closesAtHour)}:00 local`;
};

const OPEN_LABELS: Record<OfficeOpenState, string> = {
	open: 'Open now',
	closed: 'Closed',
	unknown: 'Zone unavailable'
};

export const readOffice = (
	office: Office,
	at: Date,
	options: { hour12: boolean; showSeconds: boolean }
): OfficeReading => {
	const openState: OfficeOpenState = openStateOf(office, at);

	return {
		office,
		time: new Intl.DateTimeFormat('en-GB', {
			timeZone: office.timeZone,
			hour: '2-digit',
			minute: '2-digit',
			...(options.showSeconds ? { second: '2-digit' } : {}),
			hour12: options.hour12
		}).format(at),
		date: new Intl.DateTimeFormat('en-GB', {
			timeZone: office.timeZone,
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		}).format(at),
		openState,
		openLabel: OPEN_LABELS[openState]
	};
};

export type SurfaceTier = 'small' | 'medium' | 'large';

/** Tiers the surface so type and column count step down together instead of clipping. */
export const tierFor = (width: number, height: number): SurfaceTier => {
	const shortest: number = Math.min(width, height);

	if (shortest < 700) return 'small';

	return shortest < 900 ? 'medium' : 'large';
};

/**
 * Column count is chosen by how many offices there are, not by the surface width alone: two
 * offices stretched across six columns reads as a broken board. A narrow surface still caps the
 * count, because four columns of clock on a square panel overflow rather than shrink.
 */
export const columnsFor = (count: number, portrait: boolean, tier: SurfaceTier = 'large'): number => {
	if (count <= 0) return 1;
	if (portrait) return count <= 4 ? 1 : 2;

	const cap: number = tier === 'small' ? 2 : tier === 'medium' ? 2 : 4;

	return Math.min(count, Math.min(cap, count <= 4 ? count : 3));
};
