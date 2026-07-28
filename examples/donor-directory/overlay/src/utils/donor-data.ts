import type {
	DatasourceValueShape,
	DirectoryDataIssue,
	DirectoryDataState,
	DonorDataMapping,
	DonorRecord,
	DonorSortableValue,
	DonorSortDirection
} from '@interfaces/donor-directory.interface';

import { isRecord, parseSerializedValue } from '@utils/datasource';

export interface ExtractedTableRows {
	rows: unknown[];
	header: Record<string, unknown> | null;
	shape: DatasourceValueShape;
}

export type ConfiguredTableRowsResult =
	| { status: 'unbound'; issue: 'missing-value' }
	| { status: 'invalid'; issue: DirectoryDataIssue }
	| { status: 'valid'; table: ExtractedTableRows };

const hasOwn = (record: Readonly<Record<string, unknown>>, key: string): boolean => {
	return Object.prototype.hasOwnProperty.call(record, key);
};

const normalizedFieldName = (value: string): string => {
	return value.trim().toLocaleLowerCase();
};

const primitiveDisplayValue = (value: unknown): string => {
	if (typeof value === 'string') {
		return value.trim();
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}

	if (typeof value === 'boolean') {
		return String(value);
	}

	return '';
};

const parsedRecord = (value: unknown): Record<string, unknown> | null => {
	const parsed: unknown = parseSerializedValue(value);

	return isRecord(parsed) ? parsed : null;
};

const selectedTable = (value: unknown): ExtractedTableRows | null => {
	const table: Record<string, unknown> | null = parsedRecord(value);

	if (!table) {
		return null;
	}

	const header: unknown = parseSerializedValue(table.header);
	const rows: unknown = parseSerializedValue(table.rows);

	if (!isRecord(header) || !Array.isArray(rows)) {
		return null;
	}

	return {
		rows: rows as unknown[],
		header,
		shape: 'selected-table'
	};
};

const keyMatching = (record: Readonly<Record<string, unknown>>, configuredKey: string): string | undefined => {
	const field: string = configuredKey.trim();

	if (!field) {
		return undefined;
	}

	if (hasOwn(record, field)) {
		return field;
	}

	const normalizedKey: string = normalizedFieldName(field);
	const keys: string[] = Object.keys(record);

	for (let index: number = 0; index < keys.length; index += 1) {
		const candidate: string = keys[index];

		if (normalizedFieldName(candidate) === normalizedKey) {
			return candidate;
		}
	}

	return undefined;
};

export const extractConfiguredTableRows = (value: unknown, configuredTableName: string): ConfiguredTableRowsResult => {
	const parsed: unknown = parseSerializedValue(value);

	if (parsed === undefined || parsed === null || (typeof parsed === 'string' && parsed.trim() === '')) {
		return { status: 'unbound', issue: 'missing-value' };
	}

	if (Array.isArray(parsed)) {
		return {
			status: 'valid',
			table: {
				rows: parsed as unknown[],
				header: null,
				shape: 'row-array'
			}
		};
	}

	const directTable: ExtractedTableRows | null = selectedTable(parsed);

	if (directTable) {
		return { status: 'valid', table: directTable };
	}

	if (!isRecord(parsed)) {
		return { status: 'invalid', issue: 'invalid-wrapper' };
	}

	const tableName: string = configuredTableName.trim();

	if (!tableName) {
		return { status: 'invalid', issue: 'missing-table-name' };
	}

	const matchingTableKey: string | undefined = keyMatching(parsed, tableName);

	if (matchingTableKey === undefined) {
		return { status: 'invalid', issue: 'missing-table' };
	}

	const nestedTable: ExtractedTableRows | null = selectedTable(parsed[matchingTableKey]);

	if (!nestedTable) {
		return { status: 'invalid', issue: 'invalid-wrapper' };
	}

	return {
		status: 'valid',
		table: {
			...nestedTable,
			shape: 'native-table'
		}
	};
};

export const readMappedField = (row: Readonly<Record<string, unknown>>, configuredColumn: string): unknown => {
	const matchingKey: string | undefined = keyMatching(row, configuredColumn);

	return matchingKey === undefined ? undefined : row[matchingKey];
};

export const safePrimitiveDisplayValue = (value: unknown): string => {
	return primitiveDisplayValue(value);
};

const isStructuredDate = (record: Record<string, unknown>): boolean => {
	return hasOwn(record, 'date') && primitiveDisplayValue(record.date) !== '';
};

const isFilePicker = (record: Record<string, unknown>): boolean => {
	const hasFileIdentity: boolean = hasOwn(record, 'id') || hasOwn(record, 'location');

	return hasFileIdentity && hasOwn(record, 'name') && primitiveDisplayValue(record.name) !== '';
};

export const safeDisplayValue = (value: unknown): string => {
	const primitive: string = primitiveDisplayValue(value);

	if (primitive) {
		return primitive;
	}

	if (!isRecord(value)) {
		return '';
	}

	if (isStructuredDate(value)) {
		return primitiveDisplayValue(value.date);
	}

	if (isFilePicker(value)) {
		return primitiveDisplayValue(value.name);
	}

	return '';
};

export const normalizeCategoryKey = (value: unknown): string => {
	const text: string = primitiveDisplayValue(value).replace(/\s+/g, ' ').trim();

	if (!text) {
		return '';
	}

	let decomposed: string = text;
	const normalize: ((form?: string) => string) | undefined = (
		decomposed as string & { normalize?: (form?: string) => string }
	).normalize;

	if (typeof normalize === 'function') {
		try {
			decomposed = normalize.call(decomposed, 'NFD');
		} catch {
			decomposed = text;
		}
	}

	return decomposed.replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
};

export const normalizeSearchText = (value: unknown): string => {
	return normalizeCategoryKey(value);
};

export const finiteNumber = (value: unknown): number | null => {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value !== 'string') {
		return null;
	}

	const text: string = value.trim();

	if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
		return null;
	}

	const numberValue: number = Number(text);

	return Number.isFinite(numberValue) ? numberValue : null;
};

export const normalizeSortDirection = (value: unknown): DonorSortDirection => {
	const direction: string = typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';

	if (direction === 'ascending' || direction === 'asc') {
		return 'ascending';
	}

	if (direction === 'descending' || direction === 'desc') {
		return 'descending';
	}

	return 'source';
};

export const resolveNumberLocale = (value: unknown, fallback = 'en-US'): string => {
	const requested: string = typeof value === 'string' ? value.trim() : '';
	const fallbackLocale: string = typeof fallback === 'string' && fallback.trim() ? fallback.trim() : 'en-US';

	if (requested) {
		try {
			new Intl.NumberFormat(requested);

			return requested;
		} catch {
			// Continue to the deterministic fallback.
		}
	}

	try {
		new Intl.NumberFormat(fallbackLocale);

		return fallbackLocale;
	} catch {
		return 'en-US';
	}
};

const tokenizeNaturalText = (value: string): string[] => {
	const tokens: RegExpMatchArray | null = value.match(/\d+(?:\.\d+)?|\D+/g);

	return tokens ? (Array.prototype.slice.call(tokens) as string[]) : [''];
};

const compareNaturalFallback = (left: string, right: string): number => {
	const normalizedLeft: string = normalizeSearchText(left);
	const normalizedRight: string = normalizeSearchText(right);
	const leftTokens: string[] = tokenizeNaturalText(normalizedLeft);
	const rightTokens: string[] = tokenizeNaturalText(normalizedRight);
	const tokenCount: number = Math.max(leftTokens.length, rightTokens.length);

	for (let index: number = 0; index < tokenCount; index += 1) {
		const leftToken: string = leftTokens[index] || '';
		const rightToken: string = rightTokens[index] || '';

		if (leftToken === rightToken) {
			continue;
		}

		const leftNumber: number | null = finiteNumber(leftToken);
		const rightNumber: number | null = finiteNumber(rightToken);

		if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
			return leftNumber < rightNumber ? -1 : 1;
		}

		return leftToken < rightToken ? -1 : 1;
	}

	return 0;
};

export const createNaturalComparator = (locale: unknown): ((left: string, right: string) => number) => {
	const resolvedLocale: string = resolveNumberLocale(locale);

	try {
		const collator: Intl.Collator = new Intl.Collator(resolvedLocale, {
			numeric: true,
			sensitivity: 'base',
			usage: 'sort'
		});

		return (left: string, right: string): number => {
			const result: number = collator.compare(left, right);

			return result === 0 ? compareNaturalFallback(left, right) : result;
		};
	} catch {
		return compareNaturalFallback;
	}
};

const sortableValue = (value: unknown): DonorSortableValue => {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}

	const displayValue: string = safeDisplayValue(value);

	return displayValue || null;
};

const blankSortableValue = (value: DonorSortableValue): boolean => {
	return value === null || (typeof value === 'string' && value.trim() === '');
};

const compareSortableValues = (
	left: DonorSortableValue,
	right: DonorSortableValue,
	compareText: (left: string, right: string) => number
): number => {
	const leftNumber: number | null = finiteNumber(left);
	const rightNumber: number | null = finiteNumber(right);

	if (leftNumber !== null && rightNumber !== null) {
		if (leftNumber === rightNumber) {
			return 0;
		}

		return leftNumber < rightNumber ? -1 : 1;
	}

	return compareText(String(left), String(right));
};

export const sortDonorRecords = (
	records: readonly DonorRecord[],
	directionValue: unknown,
	locale: unknown
): DonorRecord[] => {
	const direction: DonorSortDirection = normalizeSortDirection(directionValue);
	const compareText: (left: string, right: string) => number = createNaturalComparator(locale);
	const decorated: Array<{ donor: DonorRecord; inputIndex: number }> = records.map(
		(donor: DonorRecord, inputIndex: number): { donor: DonorRecord; inputIndex: number } => ({
			donor,
			inputIndex
		})
	);

	decorated.sort(
		(left: { donor: DonorRecord; inputIndex: number }, right: { donor: DonorRecord; inputIndex: number }): number => {
			if (direction !== 'source') {
				const leftBlank: boolean = blankSortableValue(left.donor.sortValue);
				const rightBlank: boolean = blankSortableValue(right.donor.sortValue);

				if (leftBlank !== rightBlank) {
					return leftBlank ? 1 : -1;
				}

				if (!leftBlank && !rightBlank) {
					const valueComparison: number = compareSortableValues(
						left.donor.sortValue,
						right.donor.sortValue,
						compareText
					);

					if (valueComparison !== 0) {
						return direction === 'descending' ? -valueComparison : valueComparison;
					}
				}
			}

			if (left.donor.sourceOrder !== right.donor.sourceOrder) {
				return left.donor.sourceOrder - right.donor.sourceOrder;
			}

			if (left.donor.sourceIndex !== right.donor.sourceIndex) {
				return left.donor.sourceIndex - right.donor.sourceIndex;
			}

			return left.inputIndex - right.inputIndex;
		}
	);

	return decorated.map((entry: { donor: DonorRecord }): DonorRecord => entry.donor);
};

export const mappedColumnExists = (header: Record<string, unknown> | null, column: string): boolean => {
	if (!header || Object.keys(header).length === 0) {
		return true;
	}

	return keyMatching(header, column) !== undefined;
};

const mappedColumnType = (header: Record<string, unknown> | null, column: string): string => {
	if (!header) {
		return '';
	}

	const matchingKey: string | undefined = keyMatching(header, column);

	if (matchingKey === undefined) {
		return '';
	}

	const descriptor: unknown = header[matchingKey];

	if (typeof descriptor === 'string') {
		return descriptor.trim().toLocaleLowerCase();
	}

	if (isRecord(descriptor)) {
		for (const property of ['type', 'dataType', 'valueType']) {
			const value: unknown = descriptor[property];

			if (typeof value === 'string' && value.trim() !== '') {
				return value.trim().toLocaleLowerCase();
			}
		}
	}

	return '';
};

const numberColumnDisplayValue = (
	value: unknown,
	column: string,
	header: Record<string, unknown> | null,
	mapping: DonorDataMapping
): string => {
	const fallback: string = safeDisplayValue(value);

	if (!mapping.formatNumberColumnsAsCurrency || mappedColumnType(header, column) !== 'number') {
		return fallback;
	}

	const numericValue: number | null = finiteNumber(value);

	if (numericValue === null) {
		return fallback;
	}

	try {
		const formatted: string = new Intl.NumberFormat(resolveNumberLocale(mapping.numberLocale), {
			useGrouping: true,
			minimumFractionDigits: 0,
			maximumFractionDigits: 20
		}).format(numericValue);

		return `${mapping.currencySymbol}${formatted}`;
	} catch {
		return fallback;
	}
};

const dataState = (
	status: DirectoryDataState['status'],
	records: DonorRecord[],
	sourceShape: DatasourceValueShape | null,
	totalRows: number,
	skippedRows: number,
	issue: DirectoryDataIssue | null
): DirectoryDataState => ({
	status,
	records,
	sourceShape,
	totalRows,
	skippedRows,
	issue
});

const sourceOrder = (row: Readonly<Record<string, unknown>>, sourceIndex: number): number => {
	const indexedOrder: number | null = finiteNumber(readMappedField(row, '_index'));

	return indexedOrder === null ? sourceIndex : indexedOrder;
};

const donorId = (identity: string, categoryKey: string, order: number, sourceIndex: number): string => {
	return `donor:${String(order)}:${String(sourceIndex)}:${categoryKey}:${normalizeSearchText(identity)}`;
};

export const normalizeDonorData = (value: unknown, mapping: DonorDataMapping): DirectoryDataState => {
	const extracted: ConfiguredTableRowsResult = extractConfiguredTableRows(value, mapping.donorTableName);

	if (extracted.status === 'unbound') {
		return dataState('unbound', [], null, 0, 0, extracted.issue);
	}

	if (extracted.status === 'invalid') {
		return dataState('invalid', [], null, 0, 0, extracted.issue);
	}

	const entryField1Column: string = mapping.entryField1Column.trim();
	const categoryColumn: string = mapping.categoryColumn.trim();
	const { header, rows, shape } = extracted.table;

	if (!entryField1Column) {
		return dataState('invalid', [], shape, rows.length, rows.length, 'missing-entry-field-1-mapping');
	}

	if (!categoryColumn) {
		return dataState('invalid', [], shape, rows.length, rows.length, 'missing-category-mapping');
	}

	if (!mappedColumnExists(header, entryField1Column)) {
		return dataState('invalid', [], shape, rows.length, rows.length, 'missing-entry-field-1-column');
	}

	if (!mappedColumnExists(header, categoryColumn)) {
		return dataState('invalid', [], shape, rows.length, rows.length, 'missing-category-column');
	}

	if (rows.length === 0) {
		return dataState('empty', [], shape, 0, 0, null);
	}

	const entryField2Column: string = mapping.entryField2Column.trim();
	const entryField3Column: string = mapping.entryField3Column.trim();
	const sortColumn: string = mapping.sortColumn.trim();
	const records: DonorRecord[] = [];

	for (let sourceIndex: number = 0; sourceIndex < rows.length; sourceIndex += 1) {
		const parsedRow: unknown = parseSerializedValue(rows[sourceIndex]);

		if (!isRecord(parsedRow)) {
			continue;
		}

		const field1Value: unknown = readMappedField(parsedRow, entryField1Column);
		const identityText: string = safeDisplayValue(field1Value);
		const field1Text: string = numberColumnDisplayValue(field1Value, entryField1Column, header, mapping);
		const category: string = safePrimitiveDisplayValue(readMappedField(parsedRow, categoryColumn));
		const categoryKey: string = normalizeCategoryKey(category);

		if (!identityText || !categoryKey) {
			continue;
		}

		const order: number = sourceOrder(parsedRow, sourceIndex);
		const mappedSortValue: unknown = sortColumn ? readMappedField(parsedRow, sortColumn) : field1Text;

		records.push({
			id: donorId(identityText, categoryKey, order, sourceIndex),
			field1Text,
			field2Text: entryField2Column
				? numberColumnDisplayValue(readMappedField(parsedRow, entryField2Column), entryField2Column, header, mapping)
				: '',
			field3Text: entryField3Column
				? numberColumnDisplayValue(readMappedField(parsedRow, entryField3Column), entryField3Column, header, mapping)
				: '',
			category,
			categoryKey,
			sortValue: sortableValue(mappedSortValue),
			sourceIndex,
			sourceOrder: order,
			sourceRow: parsedRow
		});
	}

	if (records.length === 0) {
		return dataState('invalid', [], shape, rows.length, rows.length, 'no-valid-rows');
	}

	const sortedRecords: DonorRecord[] = sortDonorRecords(records, mapping.sortDirection, mapping.numberLocale);

	return dataState('ready', sortedRecords, shape, rows.length, rows.length - sortedRecords.length, null);
};
