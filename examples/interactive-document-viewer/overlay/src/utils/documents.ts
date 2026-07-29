import type {
	DocumentFieldMapping,
	DocumentFilePicker,
	DocumentFilePickerId,
	DocumentMetadataValue,
	DocumentRecord,
	DocumentScheduleWindow
} from '@interfaces/document.interface';

import { extractArrayAtPaths, isRecord, parseSerializedValue } from '@utils/datasource';

const DOCUMENT_ROW_PATHS = [['rows'], ['Documents', 'rows']] as const;

const MAXIMUM_METADATA_FIELDS = 6;
const MAXIMUM_SCHEDULE_RETENTION_DAYS = 3650;
const UNCATEGORIZED = 'Uncategorized';

const normalizedText = (value: string): string => value.trim().toLocaleLowerCase();

const scalarText = (value: unknown): string => {
	if (typeof value === 'string') return value.trim();

	if (typeof value === 'number' && Number.isFinite(value)) return String(value);

	if (typeof value === 'boolean') return value ? 'Yes' : 'No';

	return '';
};

const datePartsText = (record: Record<string, unknown>): string => {
	const year: string = scalarText(record.year);
	const month: string = scalarText(record.month);
	const day: string = scalarText(record.day);

	if (!year || !month || !day) return '';

	return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const uniqueText = (values: string[]): string[] => {
	const seen = new Set<string>();
	const unique: string[] = [];

	for (const value of values) {
		const key: string = normalizedText(value);

		if (!key || seen.has(key)) continue;
		seen.add(key);
		unique.push(value);
	}

	return unique;
};

const displayText = (value: unknown, visited = new Set<object>(), depth = 0): string => {
	const parsed: unknown = parseSerializedValue(value);
	const scalar: string = scalarText(parsed);

	if (scalar) return scalar;

	if (parsed === null || parsed === undefined || depth >= 4) return '';

	if (Array.isArray(parsed)) {
		return uniqueText(
			parsed.map((item: unknown): string => displayText(item, visited, depth + 1)).filter(Boolean)
		).join(', ');
	}

	if (!isRecord(parsed) || visited.has(parsed)) return '';

	visited.add(parsed);

	const dateText: string = datePartsText(parsed);

	if (dateText) return dateText;

	for (const key of ['label', 'displayValue', 'displayName', 'name', 'title', 'text', 'date', 'value']) {
		const preferred: string = displayText(parsed[key], visited, depth + 1);

		if (preferred) return preferred;
	}

	return uniqueText(
		Object.keys(parsed)
			.map((key: string): string => displayText(parsed[key], visited, depth + 1))
			.filter(Boolean)
	).join(', ');
};

const readField = (row: Record<string, unknown>, configuredName: string): unknown => {
	const name: string = configuredName.trim();

	if (!name) return undefined;

	if (Object.prototype.hasOwnProperty.call(row, name)) return row[name];

	const normalizedName: string = normalizedText(name);
	const matchingKey: string | undefined = Object.keys(row).find(
		(key: string): boolean => normalizedText(key) === normalizedName
	);

	return matchingKey === undefined ? undefined : row[matchingKey];
};

const datasourceHeader = (value: unknown): Record<string, unknown> | null => {
	const parsed: unknown = parseSerializedValue(value);

	if (!isRecord(parsed)) return null;

	const directHeader: unknown = parseSerializedValue(parsed.header);

	if (isRecord(directHeader)) return directHeader;

	const documentsTable: unknown = parseSerializedValue(parsed.Documents);

	if (!isRecord(documentsTable)) return null;

	const nestedHeader: unknown = parseSerializedValue(documentsTable.header);

	return isRecord(nestedHeader) ? nestedHeader : null;
};

const schedulingFieldEnabled = (value: unknown, configuredName: string): boolean => {
	if (!configuredName.trim()) return false;

	const header: Record<string, unknown> | null = datasourceHeader(value);

	if (!header) return true;

	return normalizedText(scalarText(readField(header, configuredName))) === 'scheduling';
};

const scheduleTimestamp = (dateValue: unknown, timeValue: unknown, endOfDay: boolean): number | undefined => {
	const dateText: string = scalarText(dateValue);
	const dateMatch: RegExpMatchArray | null = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);

	if (!dateMatch) return undefined;

	const timeText: string = scalarText(timeValue);
	const timeMatch: RegExpMatchArray | null = timeText.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

	if (timeText && !timeMatch) return undefined;

	const year = Number(dateMatch[1]);
	const month = Number(dateMatch[2]);
	const day = Number(dateMatch[3]);
	const hour = timeMatch ? Number(timeMatch[1]) : endOfDay ? 23 : 0;
	const minute = timeMatch ? Number(timeMatch[2]) : endOfDay ? 59 : 0;
	const second = timeMatch?.[3] ? Number(timeMatch[3]) : endOfDay ? 59 : 0;
	const millisecond = endOfDay && !timeMatch ? 999 : 0;

	if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return undefined;

	const date = new Date(year, month - 1, day, hour, minute, second, millisecond);

	if (
		date.getFullYear() !== year ||
		date.getMonth() !== month - 1 ||
		date.getDate() !== day ||
		date.getHours() !== hour ||
		date.getMinutes() !== minute ||
		date.getSeconds() !== second
	) {
		return undefined;
	}

	return date.getTime();
};

const scheduleWindows = (value: unknown): DocumentScheduleWindow[] => {
	const parsed: unknown = parseSerializedValue(value);

	if (!isRecord(parsed)) return [];

	const intervals: unknown = parseSerializedValue(parsed.intervals);

	if (!Array.isArray(intervals)) return [];

	const windows: DocumentScheduleWindow[] = [];

	for (const rawInterval of intervals) {
		const interval: unknown = parseSerializedValue(rawInterval);

		if (!isRecord(interval) || interval.isExcluded === true) continue;

		const startAt: number | undefined = scheduleTimestamp(interval.from, interval.fromTime, false);
		const endAt: number | undefined = scheduleTimestamp(interval.to, interval.toTime, true);

		if (startAt === undefined && endAt === undefined) continue;

		if (startAt !== undefined && endAt !== undefined && startAt > endAt) continue;

		windows.push({
			...(endAt === undefined ? {} : { endAt }),
			...(startAt === undefined ? {} : { startAt })
		});
	}

	return windows;
};

const fieldLabel = (field: string): string => {
	return field
		.replace(/[_-]+/g, ' ')
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/\s+/g, ' ')
		.trim();
};

const metadataFields = (fields: readonly string[]): string[] => {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const rawField of fields.slice(0, MAXIMUM_METADATA_FIELDS)) {
		const field: string = typeof rawField === 'string' ? rawField.trim() : '';
		const key: string = normalizedText(field);

		if (!field || seen.has(key)) continue;
		seen.add(key);
		normalized.push(field);
	}

	return normalized;
};

const filePickerId = (value: unknown): DocumentFilePickerId | undefined => {
	if (typeof value === 'string' && value.trim()) return value;

	if (typeof value === 'number' && Number.isFinite(value)) return value;

	return undefined;
};

export const normalizeDocumentFilePicker = (value: unknown): DocumentFilePicker | null => {
	const parsed: unknown = parseSerializedValue(value);

	if (!isRecord(parsed)) return null;

	const id: DocumentFilePickerId | undefined = filePickerId(parsed.id);
	const name: string = scalarText(parsed.name);
	const location: string = scalarText(parsed.location);

	if (id === undefined || !name || !location) return null;

	return {
		...parsed,
		id,
		location,
		name
	};
};

const documentId = (
	row: Record<string, unknown>,
	pdf: DocumentFilePicker | null,
	title: string,
	category: string,
	index: number
): string => {
	if (pdf) return String(pdf.id);

	const rowId: DocumentFilePickerId | undefined = filePickerId(row.id);

	if (rowId !== undefined) return String(rowId);

	return `${normalizedText(category)}::${normalizedText(title)}::${index + 1}`;
};

export const normalizeDocuments = (value: unknown, mapping: DocumentFieldMapping): DocumentRecord[] => {
	const rows: unknown[] = extractArrayAtPaths(value, DOCUMENT_ROW_PATHS) ?? [];
	const configuredMetadataFields: string[] = metadataFields(mapping.metadataFields);
	const scheduleEnabled: boolean = schedulingFieldEnabled(value, mapping.scheduleField);
	const documents: DocumentRecord[] = [];

	for (const [sourceIndex, rawRow] of rows.entries()) {
		const parsedRow: unknown = parseSerializedValue(rawRow);

		if (!isRecord(parsedRow)) continue;

		const pdf: DocumentFilePicker | null = normalizeDocumentFilePicker(readField(parsedRow, mapping.pdfField));
		const mappedTitle: string = displayText(readField(parsedRow, mapping.titleField));
		const title: string =
			mappedTitle || pdf?.name.replace(/\.pdf$/i, '').trim() || `Untitled document ${sourceIndex + 1}`;
		const category: string = displayText(readField(parsedRow, mapping.categoryField)) || UNCATEGORIZED;
		const metadata: DocumentMetadataValue[] = [];
		const normalizedScheduleWindows: DocumentScheduleWindow[] = scheduleEnabled
			? scheduleWindows(readField(parsedRow, mapping.scheduleField))
			: [];

		for (const field of configuredMetadataFields) {
			const rawValue: unknown = readField(parsedRow, field);
			const metadataValue: string = displayText(rawValue);

			if (!metadataValue) continue;

			metadata.push({
				field,
				label: fieldLabel(field),
				rawValue,
				value: metadataValue
			});
		}

		const filterText: string = normalizedText(
			[title, category, pdf?.name ?? '', ...metadata.map((item: DocumentMetadataValue): string => item.value)].join(' ')
		);

		documents.push({
			category,
			filterText,
			id: documentId(parsedRow, pdf, title, category, sourceIndex),
			metadata,
			pdf,
			scheduleWindows: normalizedScheduleWindows,
			sourceIndex,
			sourceRow: parsedRow,
			title
		});
	}

	return documents;
};

const scheduleEndWithRetention = (endAt: number, retentionDays: number): number => {
	const retainedUntil = new Date(endAt);

	retainedUntil.setDate(retainedUntil.getDate() + retentionDays);

	return retainedUntil.getTime();
};

export const filterDocumentsBySchedule = (
	documents: readonly DocumentRecord[],
	now: number,
	retentionDays: number
): DocumentRecord[] => {
	const currentTime: number = Number.isFinite(now) ? now : Date.now();
	const normalizedRetentionDays: number = Number.isFinite(retentionDays)
		? Math.min(MAXIMUM_SCHEDULE_RETENTION_DAYS, Math.max(0, Math.floor(retentionDays)))
		: 0;

	return documents.filter((document: DocumentRecord): boolean => {
		if (document.scheduleWindows.length === 0) return true;

		return document.scheduleWindows.some((window: DocumentScheduleWindow): boolean => {
			const startsInTime: boolean = window.startAt === undefined || currentTime >= window.startAt;
			const endsInTime: boolean =
				window.endAt === undefined || currentTime <= scheduleEndWithRetention(window.endAt, normalizedRetentionDays);

			return startsInTime && endsInTime;
		});
	});
};

export const documentCategories = (documents: readonly DocumentRecord[]): string[] => {
	return uniqueText(documents.map((document: DocumentRecord): string => document.category));
};

export const filterDocuments = (
	documents: readonly DocumentRecord[],
	category: string,
	query: string
): DocumentRecord[] => {
	const categoryFilter: string = normalizedText(category);
	const queryTerms: string[] = uniqueText(query.split(/\s+/).map(normalizedText).filter(Boolean));

	return documents.filter((document: DocumentRecord): boolean => {
		const matchesCategory: boolean = !categoryFilter || normalizedText(document.category) === categoryFilter;
		const matchesQuery: boolean = queryTerms.every((term: string): boolean => document.filterText.includes(term));

		return matchesCategory && matchesQuery;
	});
};
