export type OfficeOpenState = 'open' | 'closed' | 'unknown';

export interface Office {
	/** Stable key for list rendering and assertions. */
	id: string;
	name: string;
	region: string;
	/** IANA zone, e.g. `Europe/Budapest`. `unknown` when the row's zone is unusable. */
	timeZone: string;
	/** Local hour the office opens, inclusive. */
	opensAtHour: number;
	/** Local hour the office closes, exclusive. */
	closesAtHour: number;
	/** False when the row's timezone could not be resolved, so the column states why. */
	zoneResolved: boolean;
}

export interface OfficeReading {
	office: Office;
	time: string;
	date: string;
	openState: OfficeOpenState;
	openLabel: string;
}
