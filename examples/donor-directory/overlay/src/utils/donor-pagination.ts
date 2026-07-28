import type {
	AutoplayAdvance,
	AutoplayFrame,
	DirectoryCategory,
	DirectoryPage,
	DonorRecord
} from '@interfaces/donor-directory.interface';

import { ALL_CATEGORY_KEY } from '@utils/donor-categories';

const positiveInteger = (value: unknown, fallback: number, maximum?: number): number => {
	const numericValue: number = typeof value === 'number' ? value : Number(value);

	if (!Number.isFinite(numericValue) || numericValue <= 0) {
		return fallback;
	}

	const integerValue: number = Math.max(1, Math.floor(numericValue));

	return maximum === undefined ? integerValue : Math.min(maximum, integerValue);
};

export const directoryPageSize = (directoryColumns: unknown, entriesPerColumn: unknown): number => {
	const columns: number = positiveInteger(directoryColumns, 1, 4);
	const entries: number = positiveInteger(entriesPerColumn, 1);

	return columns * entries;
};

export const paginateDonors = (donors: readonly DonorRecord[], pageSizeValue: unknown): DonorRecord[][] => {
	if (donors.length === 0) {
		return [];
	}

	const pageSize: number = positiveInteger(pageSizeValue, 1);
	const pages: DonorRecord[][] = [];

	for (let offset: number = 0; offset < donors.length; offset += pageSize) {
		pages.push(donors.slice(offset, offset + pageSize));
	}

	return pages;
};

export const buildDirectoryPages = (
	category: DirectoryCategory,
	directoryColumns: unknown,
	entriesPerColumn: unknown
): DirectoryPage[] => {
	const donorPages: DonorRecord[][] = paginateDonors(
		category.donors,
		directoryPageSize(directoryColumns, entriesPerColumn)
	);
	const pageCount: number = donorPages.length;

	return donorPages.map((donors: DonorRecord[], pageIndex: number): DirectoryPage => ({
		categoryKey: category.key,
		categoryLabel: category.label,
		pageIndex,
		pageNumber: pageIndex + 1,
		pageCount,
		donors
	}));
};

export const clampDirectoryPageIndex = (pageIndexValue: unknown, pageCountValue: unknown): number => {
	const pageCount: number = Math.max(0, Math.floor(typeof pageCountValue === 'number' ? pageCountValue : 0));
	const requestedIndex: number =
		typeof pageIndexValue === 'number' && Number.isFinite(pageIndexValue) ? Math.floor(pageIndexValue) : 0;

	if (pageCount === 0) {
		return 0;
	}

	return Math.min(pageCount - 1, Math.max(0, requestedIndex));
};

export const directoryPageAt = (pages: readonly DirectoryPage[], pageIndexValue: unknown): DirectoryPage | null => {
	if (pages.length === 0) {
		return null;
	}

	return pages[clampDirectoryPageIndex(pageIndexValue, pages.length)] || null;
};

export const buildAutoplayFrames = (
	categories: readonly DirectoryCategory[],
	directoryColumns: unknown,
	entriesPerColumn: unknown
): AutoplayFrame[] => {
	const realCategories: DirectoryCategory[] = categories.filter(
		(category: DirectoryCategory): boolean =>
			!category.isAll && category.key !== ALL_CATEGORY_KEY && category.donors.length > 0
	);
	const provisionalFrames: Array<{
		page: DirectoryPage;
		categoryIndex: number;
	}> = [];

	for (let categoryIndex: number = 0; categoryIndex < realCategories.length; categoryIndex += 1) {
		const pages: DirectoryPage[] = buildDirectoryPages(
			realCategories[categoryIndex],
			directoryColumns,
			entriesPerColumn
		);

		for (let pageIndex: number = 0; pageIndex < pages.length; pageIndex += 1) {
			provisionalFrames.push({
				page: pages[pageIndex],
				categoryIndex
			});
		}
	}

	const frameCount: number = provisionalFrames.length;

	return provisionalFrames.map(
		(entry: { page: DirectoryPage; categoryIndex: number }, frameIndex: number): AutoplayFrame => ({
			...entry.page,
			frameIndex,
			frameCount,
			categoryIndex: entry.categoryIndex,
			categoryCount: realCategories.length,
			isFirstFrame: frameIndex === 0,
			isLastFrame: frameIndex === frameCount - 1
		})
	);
};

export const autoplayFrameAt = (frames: readonly AutoplayFrame[], frameIndexValue: unknown): AutoplayFrame | null => {
	if (frames.length === 0) {
		return null;
	}

	const frameIndex: number = clampDirectoryPageIndex(frameIndexValue, frames.length);

	return frames[frameIndex] || null;
};

export const advanceAutoplayFrame = (
	currentFrameIndexValue: unknown,
	frameCountValue: unknown,
	stopAtEnd: boolean
): AutoplayAdvance => {
	const frameCount: number = Math.max(
		0,
		Math.floor(typeof frameCountValue === 'number' && Number.isFinite(frameCountValue) ? frameCountValue : 0)
	);

	if (frameCount === 0) {
		return {
			frameIndex: 0,
			reachedEnd: true
		};
	}

	const currentFrameIndex: number =
		typeof currentFrameIndexValue === 'number' && Number.isFinite(currentFrameIndexValue)
			? Math.floor(currentFrameIndexValue)
			: -1;

	if (currentFrameIndex < 0) {
		return {
			frameIndex: 0,
			reachedEnd: false
		};
	}

	if (currentFrameIndex < frameCount - 1) {
		return {
			frameIndex: currentFrameIndex + 1,
			reachedEnd: false
		};
	}

	return stopAtEnd
		? {
				frameIndex: frameCount - 1,
				reachedEnd: true
			}
		: {
				frameIndex: 0,
				reachedEnd: true
			};
};
