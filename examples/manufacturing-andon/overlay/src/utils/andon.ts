import type {
	AndonLine,
	AndonPage,
	AndonPageSection,
	AndonStation,
	AndonSummary,
	AndonTone
} from '@interfaces/andon.interface';

const tonePriority: Record<AndonTone, number> = {
	normal: 0,
	unknown: 1,
	attention: 2,
	stopped: 3
};

const normalStates: string[] = ['normal', 'running', 'run', 'ok', 'green', 'active', 'ready', 'online'];
const attentionStates: string[] = [
	'attention',
	'warning',
	'waiting',
	'wait',
	'hold',
	'yellow',
	'blocked',
	'starved'
];
const stoppedStates: string[] = ['stopped', 'stop', 'down', 'fault', 'red', 'critical', 'offline'];

const isRecord = (value: unknown): value is Record<string, unknown> => {
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

const asArray = (value: unknown): unknown[] | undefined => {
	return Array.isArray(value) ? value.map((item: unknown): unknown => item) : undefined;
};

const textValue = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const normalizeState = (value: unknown): { label: string; original: string; tone: AndonTone } => {
	const original: string = textValue(value);
	const normalized: string = original.toLowerCase().replace(/[_-]+/g, ' ').trim();

	if (normalStates.includes(normalized)) {
		return { label: 'NORMAL', original, tone: 'normal' };
	}

	if (attentionStates.includes(normalized)) {
		return { label: 'ATTENTION', original, tone: 'attention' };
	}

	if (stoppedStates.includes(normalized)) {
		return { label: 'STOPPED', original, tone: 'stopped' };
	}

	return { label: 'UNKNOWN', original, tone: 'unknown' };
};

const fallbackReason = (tone: AndonTone, originalState: string): string => {
	if (tone === 'normal') {
		return 'Cycle within standard';
	}

	if (tone === 'attention') {
		return 'Operator attention requested';
	}

	if (tone === 'stopped') {
		return 'Line response required';
	}

	return originalState ? `Unrecognized state: ${originalState}` : 'State not supplied';
};

const highestTone = (tones: AndonTone[]): AndonTone => {
	return tones.reduce((highest: AndonTone, tone: AndonTone): AndonTone => {
		return tonePriority[tone] > tonePriority[highest] ? tone : highest;
	}, 'normal');
};

export const extractAndonRows = (rawValue: unknown): unknown[] | undefined => {
	const value: unknown = parseValue(rawValue);
	const directRows: unknown[] | undefined = asArray(value);

	if (directRows) {
		return directRows;
	}

	if (!isRecord(value)) {
		return undefined;
	}

	const selectedRows: unknown[] | undefined = asArray(value.rows);

	if (selectedRows) {
		return selectedRows;
	}

	const tableValue: unknown = parseValue(value.AndonStatus);
	const directTableRows: unknown[] | undefined = asArray(tableValue);

	if (directTableRows) {
		return directTableRows;
	}

	return isRecord(tableValue) ? asArray(tableValue.rows) : undefined;
};

export const normalizeAndonRows = (rows: unknown[]): AndonStation[] => {
	return rows
		.map((rawRow: unknown, index: number): AndonStation | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const line: string = textValue(rawRow.line);
			const station: string = textValue(rawRow.station);

			if (!line || !station) {
				return undefined;
			}

			const state = normalizeState(rawRow.state);

			return {
				key: `${line}-${station}-${index}`,
				line,
				station,
				tone: state.tone,
				stateLabel: state.label,
				originalState: state.original,
				reason: textValue(rawRow.reason) || fallbackReason(state.tone, state.original),
				ownerRole: textValue(rawRow.ownerRole) || 'Unassigned',
				elapsedDuration: textValue(rawRow.elapsedDuration) || '--'
			};
		})
		.filter((station: AndonStation | undefined): station is AndonStation => Boolean(station));
};

export const groupAndonLines = (stations: AndonStation[]): AndonLine[] => {
	const grouped: Map<string, AndonStation[]> = new Map<string, AndonStation[]>();

	for (const station of stations) {
		const existing: AndonStation[] = grouped.get(station.line) ?? [];

		existing.push(station);
		grouped.set(station.line, existing);
	}

	return Array.from(grouped.entries()).map(([name, lineStations]: [string, AndonStation[]], index: number): AndonLine => ({
		key: `${name}-${index}`,
		name,
		tone: highestTone(lineStations.map((station: AndonStation): AndonTone => station.tone)),
		exceptionCount: lineStations.filter((station: AndonStation): boolean => station.tone !== 'normal').length,
		stations: lineStations
	}));
};

const toSection = (
	line: AndonLine,
	stations: AndonStation[],
	continuedFromPrevious: boolean,
	continuesNext: boolean,
	sectionIndex: number
): AndonPageSection => ({
	...line,
	key: `${line.key}-${sectionIndex}`,
	stations,
	continuedFromPrevious,
	continuesNext,
	exceptionCount: stations.filter((station: AndonStation): boolean => station.tone !== 'normal').length,
	tone: highestTone(stations.map((station: AndonStation): AndonTone => station.tone))
});

const pageFromSections = (sections: AndonPageSection[]): AndonPage => ({
	sections,
	stationCount: sections.reduce((total: number, section: AndonPageSection): number => {
		return total + section.stations.length;
	}, 0)
});

export const paginateAndonLines = (lines: AndonLine[], stationCapacity: number): AndonPage[] => {
	const safeCapacity: number = Math.max(1, Math.floor(stationCapacity));
	const pages: AndonPage[] = [];
	let pageSections: AndonPageSection[] = [];
	let pageStationCount: number = 0;

	const flushPage = (): void => {
		if (pageSections.length > 0) {
			pages.push(pageFromSections(pageSections));
			pageSections = [];
			pageStationCount = 0;
		}
	};

	for (const line of lines) {
		if (line.stations.length <= safeCapacity) {
			if (pageStationCount > 0 && pageStationCount + line.stations.length > safeCapacity) {
				flushPage();
			}

			pageSections.push(toSection(line, line.stations, false, false, 0));
			pageStationCount += line.stations.length;

			continue;
		}

		flushPage();

		for (let index: number = 0; index < line.stations.length; index += safeCapacity) {
			const chunk: AndonStation[] = line.stations.slice(index, index + safeCapacity);
			const continuedFromPrevious: boolean = index > 0;
			const continuesNext: boolean = index + safeCapacity < line.stations.length;

			pages.push(pageFromSections([
				toSection(line, chunk, continuedFromPrevious, continuesNext, Math.floor(index / safeCapacity))
			]));
		}
	}

	flushPage();

	return pages;
};

export const summarizeAndonStations = (stations: AndonStation[]): AndonSummary => {
	const summary: AndonSummary = {
		tone: 'normal',
		total: stations.length,
		normal: 0,
		attention: 0,
		stopped: 0,
		unknown: 0
	};

	for (const station of stations) {
		summary[station.tone] += 1;
	}

	summary.tone = stations.length > 0
		? highestTone(stations.map((station: AndonStation): AndonTone => station.tone))
		: 'unknown';

	return summary;
};
