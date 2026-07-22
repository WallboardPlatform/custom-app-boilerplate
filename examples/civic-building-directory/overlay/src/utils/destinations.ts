import type { FloorId } from '@interfaces/application.interface';
import type { Destination } from '@interfaces/wayfinding.interface';

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parseValue = (value: unknown): unknown => {
	if (typeof value !== 'string') return value;

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const text = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

const optionalBoolean = (value: unknown): boolean | null => {
	if (typeof value === 'boolean') return value;

	if (typeof value === 'string' && value.toLowerCase() === 'true') return true;

	if (typeof value === 'string' && value.toLowerCase() === 'false') return false;

	return null;
};

const floor = (value: unknown): FloorId => {
	const normalized: string = text(value).replace(/^(floor|level)\s*/i, '');

	return normalized === '2' || normalized === '3' ? normalized : '1';
};

const arrayValue = (value: unknown): unknown[] | undefined => {
	return Array.isArray(value) ? value.map((item: unknown): unknown => item) : undefined;
};

export const extractDestinationRows = (rawValue: unknown): unknown[] | undefined => {
	const value: unknown = parseValue(rawValue);
	const directRows: unknown[] | undefined = arrayValue(value);

	if (directRows) return directRows;

	if (!isRecord(value)) return undefined;
	const nestedRows: unknown[] | undefined = arrayValue(value.rows);

	if (nestedRows) return nestedRows;
	const destinations: unknown = parseValue(value.Destinations);
	const destinationRows: unknown[] | undefined = arrayValue(destinations);

	if (destinationRows) return destinationRows;

	if (isRecord(destinations)) return arrayValue(destinations.rows);

	return undefined;
};

export const normalizeDestinations = (rawValue: unknown): Destination[] => {
	const rows: unknown[] = extractDestinationRows(rawValue) ?? [];

	return rows.flatMap((row: unknown): Destination[] => {
		if (!isRecord(row)) return [];
		const id: string = text(row.id);
		const name: string = text(row.name);

		if (!id || !name) return [];

		return [{
			accessible: optionalBoolean(row.accessible),
			alternateName: text(row.alternateName) || text(row.spanishName),
			category: text(row.category) || 'Public services',
			description: text(row.description),
			floor: floor(row.floor),
			hours: text(row.hours),
			id,
			keywords: text(row.keywords),
			mapLabel: text(row.mapLabel) || name,
			name,
			status: text(row.status)
		}];
	}).sort((left: Destination, right: Destination): number => Number(left.floor) - Number(right.floor)
		|| left.category.localeCompare(right.category)
		|| left.name.localeCompare(right.name));
};
