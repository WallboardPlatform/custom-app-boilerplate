import type {
	CategoryDataMapping,
	CategoryDataState,
	CategoryMetadata,
	DatasourceValueShape,
	DirectoryCategory,
	DirectoryDataIssue,
	DonorRecord
} from '@interfaces/donor-directory.interface';

import {
	createNaturalComparator,
	extractConfiguredTableRows,
	finiteNumber,
	mappedColumnExists,
	normalizeCategoryKey,
	readMappedField,
	safeDisplayValue,
	safePrimitiveDisplayValue
} from '@utils/donor-data';
import { isRecord, parseSerializedValue } from '@utils/datasource';

export const ALL_CATEGORY_KEY = '__all_donors__';

const metadataState = (
	status: CategoryDataState['status'],
	metadata: CategoryMetadata[],
	sourceShape: DatasourceValueShape | null,
	totalRows: number,
	skippedRows: number,
	issue: DirectoryDataIssue | null
): CategoryDataState => ({
	status,
	metadata,
	sourceShape,
	totalRows,
	skippedRows,
	issue
});

const metadataSourceOrder = (row: Readonly<Record<string, unknown>>, sourceIndex: number): number => {
	const indexedOrder: number | null = finiteNumber(readMappedField(row, '_index'));

	return indexedOrder === null ? sourceIndex : indexedOrder;
};

const metadataEffectiveOrder = (metadata: CategoryMetadata): number => {
	return metadata.order === null ? metadata.sourceOrder : metadata.order;
};

export const sortCategoryMetadata = (metadata: readonly CategoryMetadata[]): CategoryMetadata[] => {
	const decorated: Array<{ item: CategoryMetadata; inputIndex: number }> = metadata.map(
		(item: CategoryMetadata, inputIndex: number): { item: CategoryMetadata; inputIndex: number } => ({
			item,
			inputIndex
		})
	);

	decorated.sort(
		(
			left: { item: CategoryMetadata; inputIndex: number },
			right: { item: CategoryMetadata; inputIndex: number }
		): number => {
			const leftOrder: number = metadataEffectiveOrder(left.item);
			const rightOrder: number = metadataEffectiveOrder(right.item);

			if (leftOrder !== rightOrder) {
				return leftOrder < rightOrder ? -1 : 1;
			}

			if (left.item.sourceIndex !== right.item.sourceIndex) {
				return left.item.sourceIndex - right.item.sourceIndex;
			}

			return left.inputIndex - right.inputIndex;
		}
	);

	return decorated.map((entry: { item: CategoryMetadata }): CategoryMetadata => entry.item);
};

export const normalizeCategoryData = (value: unknown, mapping: CategoryDataMapping): CategoryDataState => {
	const extracted = extractConfiguredTableRows(value, mapping.categoryTableName);

	if (extracted.status === 'unbound') {
		return metadataState('unbound', [], null, 0, 0, extracted.issue);
	}

	if (extracted.status === 'invalid') {
		return metadataState('invalid', [], null, 0, 0, extracted.issue);
	}

	const keyColumn: string = mapping.categoryKeyColumn.trim();
	const { header, rows, shape } = extracted.table;

	if (!keyColumn) {
		return metadataState('invalid', [], shape, rows.length, rows.length, 'missing-category-key-mapping');
	}

	if (!mappedColumnExists(header, keyColumn)) {
		return metadataState('invalid', [], shape, rows.length, rows.length, 'missing-category-key-column');
	}

	if (rows.length === 0) {
		return metadataState('empty', [], shape, 0, 0, null);
	}

	const labelColumn: string = mapping.categoryLabelColumn.trim();
	const descriptionColumn: string = mapping.categoryDescriptionColumn.trim();
	const orderColumn: string = mapping.categoryOrderColumn.trim();
	const metadata: CategoryMetadata[] = [];
	const seenKeys: Record<string, true> = Object.create(null) as Record<string, true>;

	for (let sourceIndex: number = 0; sourceIndex < rows.length; sourceIndex += 1) {
		const parsedRow: unknown = parseSerializedValue(rows[sourceIndex]);

		if (!isRecord(parsedRow)) {
			continue;
		}

		const sourceKey: string = safePrimitiveDisplayValue(readMappedField(parsedRow, keyColumn));
		const key: string = normalizeCategoryKey(sourceKey);

		if (!key || seenKeys[key]) {
			continue;
		}

		seenKeys[key] = true;

		const mappedLabel: string = labelColumn ? safePrimitiveDisplayValue(readMappedField(parsedRow, labelColumn)) : '';
		const order: number | null = orderColumn ? finiteNumber(readMappedField(parsedRow, orderColumn)) : null;

		metadata.push({
			key,
			sourceKey,
			label: mappedLabel || sourceKey,
			description: descriptionColumn ? safeDisplayValue(readMappedField(parsedRow, descriptionColumn)) : '',
			order,
			sourceIndex,
			sourceOrder: metadataSourceOrder(parsedRow, sourceIndex)
		});
	}

	if (metadata.length === 0) {
		return metadataState('invalid', [], shape, rows.length, rows.length, 'no-valid-rows');
	}

	const sortedMetadata: CategoryMetadata[] = sortCategoryMetadata(metadata);

	return metadataState('ready', sortedMetadata, shape, rows.length, rows.length - sortedMetadata.length, null);
};

interface DonorCategoryGroup {
	key: string;
	sourceLabel: string;
	donors: DonorRecord[];
	firstIndex: number;
}

const directoryCategory = (group: DonorCategoryGroup, metadata: CategoryMetadata | null): DirectoryCategory => ({
	key: group.key,
	label: metadata && metadata.label ? metadata.label : group.sourceLabel,
	sourceLabel: group.sourceLabel,
	description: metadata ? metadata.description : '',
	donors: group.donors.slice(),
	donorCount: group.donors.length,
	isAll: false,
	metadata
});

export const buildDirectoryCategories = (
	donors: readonly DonorRecord[],
	categoryMetadata: readonly CategoryMetadata[] = [],
	allLabel = 'ALL',
	numberLocale = 'en-US'
): DirectoryCategory[] => {
	const groupsByKey: Record<string, DonorCategoryGroup> = Object.create(null) as Record<string, DonorCategoryGroup>;
	const groups: DonorCategoryGroup[] = [];

	for (let donorIndex: number = 0; donorIndex < donors.length; donorIndex += 1) {
		const donor: DonorRecord = donors[donorIndex];
		const key: string = donor.categoryKey || normalizeCategoryKey(donor.category);

		if (!key) {
			continue;
		}

		const existingGroup: DonorCategoryGroup | undefined = groupsByKey[key];

		if (existingGroup) {
			existingGroup.donors.push(donor);

			continue;
		}

		const nextGroup: DonorCategoryGroup = {
			key,
			sourceLabel: donor.category,
			donors: [donor],
			firstIndex: donorIndex
		};

		groupsByKey[key] = nextGroup;
		groups.push(nextGroup);
	}

	const allCategory: DirectoryCategory = {
		key: ALL_CATEGORY_KEY,
		label: allLabel.trim() || 'ALL',
		sourceLabel: allLabel.trim() || 'ALL',
		description: '',
		donors: donors.slice(),
		donorCount: donors.length,
		isAll: true,
		metadata: null
	};
	const realCategories: DirectoryCategory[] = [];
	const includedKeys: Record<string, true> = Object.create(null) as Record<string, true>;
	const seenMetadataKeys: Record<string, true> = Object.create(null) as Record<string, true>;
	const sortedMetadata: CategoryMetadata[] = sortCategoryMetadata(categoryMetadata);

	for (let metadataIndex: number = 0; metadataIndex < sortedMetadata.length; metadataIndex += 1) {
		const item: CategoryMetadata = sortedMetadata[metadataIndex];

		if (seenMetadataKeys[item.key]) {
			continue;
		}

		seenMetadataKeys[item.key] = true;

		const matchingGroup: DonorCategoryGroup | undefined = groupsByKey[item.key];

		if (!matchingGroup) {
			continue;
		}

		includedKeys[item.key] = true;
		realCategories.push(directoryCategory(matchingGroup, item));
	}

	const compareText: (left: string, right: string) => number = createNaturalComparator(numberLocale);
	const unmatchedGroups: DonorCategoryGroup[] = groups.filter(
		(group: DonorCategoryGroup): boolean => !includedKeys[group.key]
	);

	unmatchedGroups.sort((left: DonorCategoryGroup, right: DonorCategoryGroup): number => {
		const labelComparison: number = compareText(left.sourceLabel, right.sourceLabel);

		return labelComparison === 0 ? left.firstIndex - right.firstIndex : labelComparison;
	});

	for (let groupIndex: number = 0; groupIndex < unmatchedGroups.length; groupIndex += 1) {
		realCategories.push(directoryCategory(unmatchedGroups[groupIndex], null));
	}

	return [allCategory].concat(realCategories);
};

export const isAllCategoryKey = (categoryKey: unknown): boolean => {
	return categoryKey === ALL_CATEGORY_KEY;
};

export const filterDonorsByCategory = (donors: readonly DonorRecord[], categoryKey: unknown): DonorRecord[] => {
	if (isAllCategoryKey(categoryKey)) {
		return donors.slice();
	}

	const normalizedKey: string = normalizeCategoryKey(categoryKey);

	if (!normalizedKey) {
		return [];
	}

	return donors.filter((donor: DonorRecord): boolean => donor.categoryKey === normalizedKey);
};
