export interface PaginationOptions {
	balancePages?: boolean;
}

const pageCapacity = (value: number): number => {
	return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
};

export const normalizeCircularIndex = (index: number, count: number): number => {
	const normalizedCount: number = Math.max(0, Math.floor(count));

	if (normalizedCount === 0 || !Number.isFinite(index)) {
		return 0;
	}

	return ((Math.floor(index) % normalizedCount) + normalizedCount) % normalizedCount;
};

export const paginate = <T>(
	items: readonly T[],
	maximumItemsPerPage: number,
	options: PaginationOptions = {}
): T[][] => {
	if (items.length === 0) {
		return [];
	}

	const capacity: number = pageCapacity(maximumItemsPerPage);
	const pageCount: number = Math.ceil(items.length / capacity);

	if (!options.balancePages || pageCount === 1) {
		return Array.from({ length: pageCount }, (_value: unknown, pageIndex: number): T[] => {
			return items.slice(pageIndex * capacity, (pageIndex + 1) * capacity);
		});
	}

	const minimumPageSize: number = Math.floor(items.length / pageCount);
	const largerPageCount: number = items.length % pageCount;
	let offset: number = 0;

	return Array.from({ length: pageCount }, (_value: unknown, pageIndex: number): T[] => {
		const size: number = minimumPageSize + (pageIndex < largerPageCount ? 1 : 0);
		const page: T[] = items.slice(offset, offset + size);

		offset += size;

		return page;
	});
};

export const pageAt = <T>(pages: readonly T[][], index: number): T[] => {
	return pages[normalizeCircularIndex(index, pages.length)] ?? [];
};
