import type { Product } from '@interfaces/product.interface';

import sampleDatasourceJson from '../../sample-products-table-datasource.json';

type UnknownRecord = Record<string, unknown>;

const sampleRows = (sampleDatasourceJson as { Products: { rows: Product[] } }).Products.rows;

const isRecord = (value: unknown): value is UnknownRecord => {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const parseValue = (value: unknown): unknown => {
	if (typeof value !== 'string') {
		return value;
	}

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const readRows = (value: unknown): unknown[] => {
	const parsed = parseValue(value);

	if (Array.isArray(parsed)) {
		return parsed;
	}

	if (!isRecord(parsed)) {
		return [];
	}

	const products = parseValue(parsed.Products);

	if (isRecord(products) && Array.isArray(parseValue(products.rows))) {
		return parseValue(products.rows) as unknown[];
	}

	return Array.isArray(parseValue(parsed.rows)) ? parseValue(parsed.rows) as unknown[] : [];
};

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

export const SAMPLE_PRODUCTS: Product[] = sampleRows;

export const normalizeProducts = (value: unknown): Product[] => {
	return readRows(value).flatMap((row): Product[] => {
		if (!isRecord(row)) {
			return [];
		}

		const sku = text(row.sku);
		const name = text(row.name);
		const category = text(row.category);

		if (!sku || !name || !category) {
			return [];
		}

		return [{
			sku,
			name,
			category,
			description: text(row.description),
			price: text(row.price),
			badge: text(row.badge),
			availability: text(row.availability),
			detailOne: text(row.detailOne),
			detailTwo: text(row.detailTwo),
			imageKey: text(row.imageKey),
			sortOrder: typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder) ? row.sortOrder : 9999
		}];
	}).sort((left, right): number => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
};
