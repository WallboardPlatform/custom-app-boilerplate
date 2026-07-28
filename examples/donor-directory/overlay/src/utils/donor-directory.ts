export type {
	AutoplayAdvance,
	AutoplayFrame,
	CategoryDataMapping,
	CategoryDataState,
	CategoryMetadata,
	DatasourceValueShape,
	DirectoryCategory,
	DirectoryDataIssue,
	DirectoryDataState,
	DirectoryDataStatus,
	DirectoryPage,
	DonorAmountFormat,
	DonorAmountFormatOptions,
	DonorAmountValue,
	DonorDataMapping,
	DonorDataState,
	DonorRecord,
	DonorSearchMatchKind,
	DonorSearchResult,
	DonorSortableValue,
	DonorSortDirection
} from '@interfaces/donor-directory.interface';

export {
	ALL_CATEGORY_KEY,
	buildDirectoryCategories,
	filterDonorsByCategory,
	isAllCategoryKey,
	normalizeCategoryData,
	sortCategoryMetadata
} from '@utils/donor-categories';

export {
	createNaturalComparator,
	extractConfiguredTableRows,
	finiteNumber,
	mappedColumnExists,
	normalizeCategoryKey,
	normalizeDonorData,
	normalizeSearchText,
	normalizeSortDirection,
	readMappedField,
	resolveNumberLocale,
	safeDisplayValue,
	safePrimitiveDisplayValue,
	sortDonorRecords
} from '@utils/donor-data';

export { formatDonorAmount, normalizeAmountFormat, resolveCurrencyCode } from '@utils/donor-formatting';

export {
	advanceAutoplayFrame,
	autoplayFrameAt,
	buildAutoplayFrames,
	buildDirectoryPages,
	clampDirectoryPageIndex,
	directoryPageAt,
	directoryPageSize,
	paginateDonors
} from '@utils/donor-pagination';

export { rankDonorsForSearch, searchDonors, titleCaseSearchQuery } from '@utils/donor-search';
