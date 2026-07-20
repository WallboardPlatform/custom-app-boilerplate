import type { Destination } from '@interfaces/wayfinding.interface';

const isRecord = (value: unknown): value is Record<string, unknown> => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseValue = (value: unknown): unknown => {
	if (typeof value !== 'string') return value;

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const text = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const boolean = (value: unknown, fallback: boolean): boolean => {
	if (typeof value === 'boolean') return value;

	if (typeof value === 'string') {
		if (value.toLowerCase() === 'true') return true;

		if (value.toLowerCase() === 'false') return false;
	}

	return fallback;
};

export const extractDestinationRows = (rawValue: unknown): unknown[] | undefined => {
	const value: unknown = parseValue(rawValue);

	if (Array.isArray(value)) return value as unknown[];

	if (!isRecord(value)) return undefined;

	if (Array.isArray(value.rows)) return value.rows as unknown[];

	const destinations: unknown = parseValue(value.Destinations);

	if (Array.isArray(destinations)) return destinations as unknown[];

	if (isRecord(destinations) && Array.isArray(destinations.rows)) return destinations.rows as unknown[];

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
			accessible: boolean(row.accessible, false),
			category: text(row.category) || 'Other destinations',
			description: text(row.description),
			englishName: text(row.englishName),
			id,
			name,
			routeable: boolean(row.routeable, true)
		}];
	}).sort((left: Destination, right: Destination): number => {
		return left.category.localeCompare(right.category, undefined, { numeric: true })
			|| left.name.localeCompare(right.name, undefined, { numeric: true });
	});
};
