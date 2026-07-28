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

/** Zone abbreviation and UTC offset, both derivable — no extra column for the operator to fill. */
export const zoneLabel = (office: Office, at: Date): string => {
	if (!office.zoneResolved) return 'UTC fallback';

	const abbreviation: string = new Intl.DateTimeFormat('en-GB', { timeZone: office.timeZone, timeZoneName: 'short' })
		.formatToParts(at)
		.find((part): boolean => part.type === 'timeZoneName')?.value ?? '';
	const offset: string = new Intl.DateTimeFormat('en-GB', { timeZone: office.timeZone, timeZoneName: 'longOffset' })
		.formatToParts(at)
		.find((part): boolean => part.type === 'timeZoneName')?.value ?? '';

	return [abbreviation, offset].filter(Boolean).join(' · ');
};

/**
 * Hours until the office next changes state. "Closed" answers less than a passer-by wants: the
 * question behind the board is when the other end becomes reachable.
 */
export const transitionLabel = (office: Office, at: Date): string => {
	if (!office.zoneResolved) return '';

	const current: number = localHour(office, at);
	const open: boolean = openStateOf(office, at) === 'open';
	const target: number = open ? office.closesAtHour : office.opensAtHour;
	const hours: number = (target - current + 24) % 24;

	if (hours === 0) return open ? 'Closing now' : 'Opening now';

	return open ? `Closes in ${hours}h` : `Opens in ${hours}h`;
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

/** Below this a column cannot hold an office name and a clock without the name wrapping to three lines. */
const MINIMUM_COLUMN_WIDTH = 210;

/**
 * Column count follows the office count first, then the surface: two offices stretched across six
 * columns reads as a broken board, but four offices on a 600px square would each get a 150px
 * sliver, so the board wraps into rows rather than shrinking past what a column can carry.
 */
export const columnsFor = (count: number, portrait: boolean, boardWidth: number): number => {
	if (count <= 0) {
		return 1;
	}

	const ideal: number = portrait
		? (count <= 4 ? 1 : 2)
		: (count <= 4 ? count : 3);
	const affordable: number[] = [];

	for (let columns: number = ideal; columns >= 1; columns -= 1) {
		if (boardWidth <= 0 || boardWidth / columns >= MINIMUM_COLUMN_WIDTH) {
			affordable.push(columns);
		}
	}

	const widest: number = affordable[0] ?? 1;

	/*
	 * A row that is one column short leaves a hole the eye reads as a missing office, so an even
	 * split is worth one column of width — but only down to two. Dropping to a single column to
	 * divide evenly would stack every office in a tall strip, which is worse than the hole.
	 */
	if (count % widest === 0 || widest - 1 < 2 || count % (widest - 1) !== 0) {
		return widest;
	}

	return widest - 1;
};

/**
 * Tiers by the size of a single column, not by the size of the board.
 *
 * Six offices on a 1920x1080 wall give 640x430 cells; tiering on the surface calls that "large"
 * and sizes the clock for a cell three times taller than the one it actually gets. What has to
 * fit is the column.
 */
export const tierForCell = (
	boardWidth: number,
	boardHeight: number,
	count: number,
	portrait: boolean
): SurfaceTier => {
	const columns: number = columnsFor(count, portrait, boardWidth);
	const rows: number = Math.max(1, Math.ceil(Math.max(count, 1) / columns));
	// The header and board padding take roughly a fifth of the height before any column starts.
	const cellHeight: number = (boardHeight * 0.8) / rows;
	const cellWidth: number = boardWidth / columns;
	const shortest: number = Math.min(cellWidth, cellHeight);

	if (shortest < 260 || cellHeight < 360) return 'small';

	return shortest < 420 || cellHeight < 520 ? 'medium' : 'large';
};
