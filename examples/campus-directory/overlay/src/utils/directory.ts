import type { DirectoryDisplayEntry, DirectoryEntry, DirectorySourceRow } from '@interfaces/directory.interface';

import { extractArrayAtPaths, isRecord } from '@utils/datasource';

interface IndexedDirectoryEntry extends DirectoryEntry {
	sourceIndex: number;
}

const rowPaths = [
	['rows'],
	['Directory'],
	['Directory', 'rows']
] as const;

const toText = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const tokenizeNaturalText = (value: string): string[] => {
	return value.toLowerCase().match(/\d+|\D+/g) ?? [''];
};

export const compareNaturalText = (left: string, right: string): number => {
	const leftTokens: string[] = tokenizeNaturalText(left);
	const rightTokens: string[] = tokenizeNaturalText(right);
	const tokenCount: number = Math.max(leftTokens.length, rightTokens.length);

	for (let index: number = 0; index < tokenCount; index += 1) {
		const leftToken: string = leftTokens[index] ?? '';
		const rightToken: string = rightTokens[index] ?? '';

		if (leftToken === rightToken) {
			continue;
		}

		const leftNumber: number = Number(leftToken);
		const rightNumber: number = Number(rightToken);
		const bothNumeric: boolean = /^\d+$/.test(leftToken) && /^\d+$/.test(rightToken);

		if (bothNumeric && leftNumber !== rightNumber) {
			return leftNumber - rightNumber;
		}

		return leftToken < rightToken ? -1 : 1;
	}

	return 0;
};

const compareEntries = (left: IndexedDirectoryEntry, right: IndexedDirectoryEntry): number => {
	const fields: Array<keyof DirectoryEntry> = [
		'building',
		'floor',
		'department',
		'room',
		'direction',
		'accessibilityNote'
	];

	for (const field of fields) {
		const comparison: number = compareNaturalText(left[field], right[field]);

		if (comparison !== 0) {
			return comparison;
		}
	}

	return left.sourceIndex - right.sourceIndex;
};

export const normalizeDirectoryRows = (rawValue: unknown): DirectoryEntry[] => {
	const rows: unknown[] = extractArrayAtPaths(rawValue, rowPaths) ?? [];
	const normalizedRows: IndexedDirectoryEntry[] = rows
		.map((rawRow: unknown, sourceIndex: number): IndexedDirectoryEntry | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const row: DirectorySourceRow = rawRow;
			const building: string = toText(row.building);
			const floor: string = toText(row.floor);
			const department: string = toText(row.department);
			const direction: string = toText(row.direction);

			if (!building || !floor || !department || !direction) {
				return undefined;
			}

			return {
				sourceIndex,
				building,
				floor,
				department,
				room: toText(row.room),
				direction,
				accessibilityNote: toText(row.accessibilityNote)
			};
		})
		.filter((row: IndexedDirectoryEntry | undefined): row is IndexedDirectoryEntry => Boolean(row))
		.sort(compareEntries);

	return normalizedRows.map((row: IndexedDirectoryEntry): DirectoryEntry => ({
		building: row.building,
		floor: row.floor,
		department: row.department,
		room: row.room,
		direction: row.direction,
		accessibilityNote: row.accessibilityNote
	}));
};

export const markDirectoryGroups = (entries: readonly DirectoryEntry[]): DirectoryDisplayEntry[] => {
	return entries.map((entry: DirectoryEntry, index: number): DirectoryDisplayEntry => {
		const previousEntry: DirectoryEntry | undefined = entries[index - 1];
		const buildingStart: boolean = !previousEntry || previousEntry.building !== entry.building;

		return {
			...entry,
			buildingStart,
			floorStart: buildingStart || previousEntry.floor !== entry.floor
		};
	});
};
