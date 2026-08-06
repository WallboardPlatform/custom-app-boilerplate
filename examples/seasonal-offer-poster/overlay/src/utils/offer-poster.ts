import type { OfferRecord } from '@interfaces/offer-poster.interface';

/**
 * The canvas the artwork was drawn at.
 *
 * Every position in the poster is expressed in these units and scaled as one block, so the
 * composition a designer approved is the composition that renders. Nothing here reflows: a
 * surface that does not match the ratio gets a letterbox rather than a rearranged poster.
 */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

interface RawRow extends Record<string, unknown> {
	eyebrow?: unknown;
	headline?: unknown;
	price?: unknown;
	priceNote?: unknown;
	validUntil?: unknown;
	smallPrint?: unknown;
}

const text = (value: unknown, fallback = ''): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const rowsOf = (value: unknown): RawRow[] => {
	if (Array.isArray(value)) return value as RawRow[];

	if (value && typeof value === 'object') {
		for (const entry of Object.values(value as Record<string, { rows?: unknown }>)) {
			if (entry && Array.isArray(entry.rows)) return entry.rows as RawRow[];
		}
	}

	return [];
};

export const normalizeOffers = (value: unknown): OfferRecord[] => {
	return rowsOf(value)
		.map((row: RawRow, index: number): OfferRecord => ({
			id: `offer-${index}`,
			eyebrow: text(row.eyebrow),
			headline: text(row.headline),
			price: text(row.price),
			priceNote: text(row.priceNote),
			validUntil: text(row.validUntil),
			smallPrint: text(row.smallPrint)
		}))
		// A poster with no headline has nothing to say; the price alone is not an offer.
		.filter((offer: OfferRecord): boolean => offer.headline !== '');
};

/**
 * Splits the headline so the poster can set it as a stack rather than one run.
 *
 * A designed poster breaks its headline where the designer chose, and the operator types plain
 * text. Splitting on a double space keeps that control in the copy itself without inventing a
 * second column in the datasource.
 */
export const headlineLines = (headline: string): string[] => {
	return headline
		.split(/\s{2,}|\r?\n/)
		.map((line: string): string => line.trim())
		.filter((line: string): boolean => line !== '');
};

/** Rotates through offers on a fixed cadence, wrapping at the end. */
export const nextOfferIndex = (current: number, count: number): number => {
	return count <= 0 ? 0 : (current + 1) % count;
};
