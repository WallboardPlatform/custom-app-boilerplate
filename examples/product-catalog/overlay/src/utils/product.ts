import type { Product, ProductImage } from '@interfaces/product.interface';

import sampleDatasourceJson from '../../sample-products-table-datasource.json';

type UnknownRecord = Record<string, unknown>;

const sampleRows: unknown = (sampleDatasourceJson as { Products: { rows: unknown } }).Products.rows;

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

const safeImageUrl = (value: unknown): string => {
	const url = text(value);

	return /^(?:https?:\/\/|data:image\/|blob:|\/)/i.test(url) ? url : '';
};

export const normalizeProductImage = (value: unknown): ProductImage | null => {
	const parsed = parseValue(value);

	if (typeof parsed === 'string') {
		const url = safeImageUrl(parsed);

		return url ? { name: '', url } : null;
	}

	if (!isRecord(parsed)) {
		return null;
	}

	const url = safeImageUrl(parsed.location) || safeImageUrl(parsed.url) || safeImageUrl(parsed.thumbnailUrl);

	return url ? { name: text(parsed.name), url } : null;
};

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
			image: normalizeProductImage(row.image),
			sortOrder: typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder) ? row.sortOrder : 9999
		}];
	}).sort((left, right): number => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
};

export const SAMPLE_PRODUCTS: Product[] = normalizeProducts(sampleRows);
