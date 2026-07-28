export type DonorSortDirection = 'source' | 'ascending' | 'descending';

export type DatasourceValueShape = 'row-array' | 'selected-table' | 'native-table';

export type DirectoryDataStatus = 'unbound' | 'invalid' | 'empty' | 'ready';

export type DirectoryDataIssue =
	| 'missing-value'
	| 'missing-table-name'
	| 'missing-table'
	| 'invalid-wrapper'
	| 'missing-entry-field-1-mapping'
	| 'missing-category-mapping'
	| 'missing-category-key-mapping'
	| 'missing-entry-field-1-column'
	| 'missing-category-column'
	| 'missing-category-key-column'
	| 'no-valid-rows';

export type DonorAmountValue = number | string | null;

export type DonorSortableValue = number | string | null;

export interface DonorDataMapping {
	donorTableName: string;
	categoryColumn: string;
	entryField1Column: string;
	entryField2Column: string;
	entryField3Column: string;
	sortColumn: string;
	sortDirection: string;
	numberLocale: string;
	formatNumberColumnsAsCurrency: boolean;
	currencySymbol: string;
}

export interface DonorRecord {
	id: string;
	field1Text: string;
	field2Text: string;
	field3Text: string;
	category: string;
	categoryKey: string;
	sortValue: DonorSortableValue;
	sourceIndex: number;
	sourceOrder: number;
	sourceRow: Readonly<Record<string, unknown>>;
}

export interface DirectoryDataState {
	status: DirectoryDataStatus;
	records: DonorRecord[];
	sourceShape: DatasourceValueShape | null;
	totalRows: number;
	skippedRows: number;
	issue: DirectoryDataIssue | null;
}

export type DonorDataState = DirectoryDataState;

export interface CategoryDataMapping {
	categoryTableName: string;
	categoryKeyColumn: string;
	categoryLabelColumn: string;
	categoryDescriptionColumn: string;
	categoryOrderColumn: string;
	numberLocale: string;
}

export interface CategoryMetadata {
	key: string;
	sourceKey: string;
	label: string;
	description: string;
	order: number | null;
	sourceIndex: number;
	sourceOrder: number;
}

export interface CategoryDataState {
	status: DirectoryDataStatus;
	metadata: CategoryMetadata[];
	sourceShape: DatasourceValueShape | null;
	totalRows: number;
	skippedRows: number;
	issue: DirectoryDataIssue | null;
}

export interface DirectoryCategory {
	key: string;
	label: string;
	sourceLabel: string;
	description: string;
	donors: DonorRecord[];
	donorCount: number;
	isAll: boolean;
	metadata: CategoryMetadata | null;
}

export type DonorSearchMatchKind = 'prefix' | 'substring';

export interface DonorSearchResult {
	donor: DonorRecord;
	match: DonorSearchMatchKind;
	matchIndex: number;
	isBestMatch: boolean;
}

export type DonorAmountFormat = 'currency' | 'number' | 'raw';

export interface DonorAmountFormatOptions {
	format: string;
	locale: string;
	currencyCode: string;
}

export interface DirectoryPage {
	categoryKey: string;
	categoryLabel: string;
	pageIndex: number;
	pageNumber: number;
	pageCount: number;
	donors: DonorRecord[];
}

export interface AutoplayFrame extends DirectoryPage {
	frameIndex: number;
	frameCount: number;
	categoryIndex: number;
	categoryCount: number;
	isFirstFrame: boolean;
	isLastFrame: boolean;
}

export interface AutoplayAdvance {
	frameIndex: number;
	reachedEnd: boolean;
}
