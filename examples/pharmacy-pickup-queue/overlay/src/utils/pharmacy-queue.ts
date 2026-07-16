import type {
	PharmacyQueueRow,
	PharmacyQueueState,
	PharmacyQueueView
} from '@interfaces/pharmacy-queue.interface';

import { extractArrayAtPaths, isRecord } from '@utils/datasource';

const ROW_PATHS = [
	['rows'],
	['PharmacyQueue', 'rows'],
	['PharmacyQueue']
] as const;

const toText = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

export const normalizeQueueState = (value: unknown): PharmacyQueueState => {
	const state: string = toText(value)
		.toLowerCase()
		.replace(/[_-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	if (['called', 'now serving', 'serving', 'ready', 'ready for pickup', 'pickup ready'].includes(state)) {
		return 'called';
	}

	if (['waiting', 'queued', 'queue', 'next', 'pending'].includes(state)) {
		return 'waiting';
	}

	if (['hold', 'on hold', 'delayed', 'review', 'pharmacist review'].includes(state)) {
		return 'hold';
	}

	if (['served', 'collected', 'complete', 'completed', 'done', 'picked up'].includes(state)) {
		return 'complete';
	}

	return 'unknown';
};

export const extractQueueRows = (value: unknown): unknown[] => {
	return extractArrayAtPaths(value, ROW_PATHS) ?? [];
};

export const normalizeQueueRows = (value: unknown): PharmacyQueueRow[] => {
	return extractQueueRows(value)
		.map((rawRow: unknown): PharmacyQueueRow | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const ticket: string = toText(rawRow.ticket);

			if (!ticket) {
				return undefined;
			}

			return {
				ticket,
				counter: toText(rawRow.counter) || 'Counter pending',
				state: normalizeQueueState(rawRow.state),
				note: toText(rawRow.note)
			};
		})
		.filter((row: PharmacyQueueRow | undefined): row is PharmacyQueueRow => Boolean(row));
};

export const buildQueueView = (rows: PharmacyQueueRow[]): PharmacyQueueView => {
	const hero: PharmacyQueueRow | undefined = rows.find(
		(row: PharmacyQueueRow): boolean => row.state === 'called'
	);
	const upcoming: PharmacyQueueRow[] = rows.filter((row: PharmacyQueueRow): boolean => {
		return row.state === 'waiting' || row.state === 'hold' || row.state === 'unknown';
	});

	return { hero, upcoming };
};

export const queueStateLabel = (state: PharmacyQueueState): string => {
	if (state === 'hold') {
		return 'ON HOLD';
	}

	if (state === 'unknown') {
		return 'CHECK STATE';
	}

	return 'WAIT';
};

export const queueStateMark = (state: PharmacyQueueState): string => {
	if (state === 'hold') {
		return '!';
	}

	if (state === 'unknown') {
		return '?';
	}

	return String.fromCharCode(183);
};
