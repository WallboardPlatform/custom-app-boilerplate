import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { DepartureDatasource, DepartureRow, DepartureStatusTone } from '@interfaces/departure.interface';

import style from '@components/wb-app/wb-app.module.scss';

import sampleDatasourceJson from '../../../sample-datasource.json';

interface ClockValue {
	date: string;
	time: string;
}

interface Dimensions {
	width: number;
	height: number;
}

const sampleDatasource: DepartureDatasource = sampleDatasourceJson as DepartureDatasource;
const statusTones: DepartureStatusTone[] = ['boarding', 'gate', 'delayed', 'cancelled', 'scheduled', 'departed'];

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

const asUnknownArray = (value: unknown): unknown[] | undefined => {
	return Array.isArray(value) ? value.map((item: unknown): unknown => item) : undefined;
};

const extractRows = (rawValue: unknown): unknown[] | undefined => {
	const value: unknown = parseValue(rawValue);
	const directRows: unknown[] | undefined = asUnknownArray(value);

	if (directRows) {
		return directRows;
	}

	if (!isRecord(value)) {
		return undefined;
	}

	const selectedTableRows: unknown[] | undefined = asUnknownArray(value.rows);

	if (selectedTableRows) {
		return selectedTableRows;
	}

	const tableValue: unknown = parseValue(value.Departures);
	const tableRows: unknown[] | undefined = asUnknownArray(tableValue);

	if (tableRows) {
		return tableRows;
	}

	if (isRecord(tableValue)) {
		return asUnknownArray(tableValue.rows);
	}

	return undefined;
};

const toText = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const toOrder = (value: unknown, fallback: number): number => {
	const parsedValue: number = Number(value);

	return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
	if (value === undefined || value === null || value === '') {
		return fallback;
	}

	return value !== false && value !== 0 && value !== 'false';
};

const toStatusTone = (value: unknown, status: string): DepartureStatusTone => {
	const tone: string = toText(value).toLowerCase();

	if (statusTones.includes(tone as DepartureStatusTone)) {
		return tone as DepartureStatusTone;
	}

	const normalizedStatus: string = status.toLowerCase();

	if (normalizedStatus.includes('cancel')) {
		return 'cancelled';
	}

	if (normalizedStatus.includes('delay')) {
		return 'delayed';
	}

	if (normalizedStatus.includes('board') || normalizedStatus.includes('call')) {
		return 'boarding';
	}

	if (normalizedStatus.includes('gate')) {
		return 'gate';
	}

	if (normalizedStatus.includes('depart')) {
		return 'departed';
	}

	return 'scheduled';
};

const normalizeRows = (rows: unknown[]): DepartureRow[] => {
	return rows
		.map((rawRow: unknown, index: number): DepartureRow | undefined => {
			if (!isRecord(rawRow) || !toBoolean(rawRow.visible, true)) {
				return undefined;
			}

			const scheduledTime: string = toText(rawRow.scheduledTime);
			const destination: string = toText(rawRow.destination);
			const flight: string = toText(rawRow.flight);

			if (!scheduledTime || !destination || !flight) {
				return undefined;
			}

			const status: string = toText(rawRow.status) || 'ON TIME';

			return {
				sortOrder: toOrder(rawRow.sortOrder, index + 1),
				scheduledTime,
				destination,
				flight,
				airline: toText(rawRow.airline),
				terminal: toText(rawRow.terminal),
				gate: toText(rawRow.gate),
				status,
				statusTone: toStatusTone(rawRow.statusTone, status)
			};
		})
		.filter((row: DepartureRow | undefined): row is DepartureRow => Boolean(row))
		.sort((left: DepartureRow, right: DepartureRow): number => left.sortOrder - right.sortOrder);
};

const chunkRows = (items: DepartureRow[], size: number): DepartureRow[][] => {
	const chunks: DepartureRow[][] = [];

	for (let index: number = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}

	return chunks;
};

const getRowsPerPage = (dimensions: Dimensions): number => {
	if (dimensions.height <= 480) {
		return 4;
	}

	if (dimensions.height <= 620) {
		return 5;
	}

	if (dimensions.height <= 850) {
		return 7;
	}

	if (dimensions.height <= 1200) {
		return 9;
	}

	if (dimensions.height <= 1600) {
		return 11;
	}

	return 13;
};

const padNumber = (value: number): string => {
	return value < 10 ? `0${value}` : String(value);
};

const getClockValue = (): ClockValue => {
	const now: Date = new Date();
	const date: string = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: '2-digit',
		month: 'short'
	}).format(now);

	return {
		date,
		time: `${padNumber(now.getHours())}:${padNumber(now.getMinutes())}`
	};
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const fitBoardTitle = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 55,
		widthOnly: true,
		watch: (): string => settings().boardTitle
	});
	const [clock, setClock] = createSignal<ClockValue>(getClockValue());
	const [dimensions, setDimensions] = createSignal<Dimensions>({ width: 1920, height: 1080 });
	const [pageIndex, setPageIndex] = createSignal<number>(0);
	const rawData: Accessor<unknown> = createMemo((): unknown => dataSources().departuresData?.value);
	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'departuresData');
	});
	const rows: Accessor<DepartureRow[]> = createMemo((): DepartureRow[] => {
		const sourceRows: unknown[] = hasBoundDatasource()
			? extractRows(rawData()) ?? []
			: extractRows(sampleDatasource) ?? [];

		return normalizeRows(sourceRows);
	});
	const rowsPerPage: Accessor<number> = createMemo((): number => getRowsPerPage(dimensions()));
	const pages: Accessor<DepartureRow[][]> = createMemo((): DepartureRow[][] => chunkRows(rows(), rowsPerPage()));
	const pageCount: Accessor<number> = createMemo((): number => Math.max(pages().length, 1));
	const currentRows: Accessor<DepartureRow[]> = createMemo((): DepartureRow[] => {
		return pages()[pageIndex() % pageCount()] ?? [];
	});
	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--board-background': settings().backgroundColor,
		'--board-text': settings().textColor,
		'--board-accent': settings().accentColor
	}));

	onMount((): void => {
		const updateDimensions = (width: number, height: number): void => {
			setDimensions({ width: Math.round(width), height: Math.round(height) });
		};
		const initialBounds: DOMRect = props.hostElement.getBoundingClientRect();
		const resizeObserver: ResizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
			const entry: ResizeObserverEntry | undefined = entries[0];

			if (entry) {
				updateDimensions(entry.contentRect.width, entry.contentRect.height);
			}
		});
		const intervalId: number = window.setInterval((): void => {
			setClock(getClockValue());
		}, 30000);

		updateDimensions(initialBounds.width, initialBounds.height);
		resizeObserver.observe(props.hostElement);

		onCleanup((): void => {
			resizeObserver.disconnect();
			window.clearInterval(intervalId);
		});
	});

	createEffect((): void => {
		const count: number = pageCount();

		if (pageIndex() >= count) {
			setPageIndex(0);
		}
	});

	createEffect((): void => {
		const count: number = pageCount();
		const duration: number = settings().pageDurationSeconds;

		if (count <= 1) {
			return;
		}

		const intervalId: number = window.setInterval((): void => {
			setPageIndex((current: number): number => (current + 1) % count);
		}, duration * 1000);

		onCleanup((): void => window.clearInterval(intervalId));
	});

	return (
		<div
			class={`wb-app ${style['wb-app']}`}
			classList={{
				'departures-board--compact': dimensions().height <= 620,
				'departures-board--narrow': dimensions().width <= 700,
				'departures-board--portrait': dimensions().height > dimensions().width
			}}
			data-host-ready={Boolean(props.hostElement)}
			style={themeStyle()}
		>
			<header class="departures-header">
				<div class="departures-brand">
					<strong>{settings().airportCode}</strong>
					<div>
						<span>{settings().airportName}</span>
						<h1 ref={fitBoardTitle}>{settings().boardTitle}</h1>
					</div>
				</div>
				<div class="departures-terminal">
					<span>DEPARTING FROM</span>
					<strong>{settings().terminalLabel}</strong>
				</div>
				<time>
					<span>{clock().date}</span>
					<strong>{clock().time}</strong>
					<small>LOCAL TIME</small>
				</time>
			</header>

			<div class="departures-ribbon">
				<strong>{settings().informationLabel}</strong>
				<div>
					<span>{rows().length} FLIGHTS</span>
					<Show when={pageCount() > 1}><b>PAGE {pageIndex() + 1} / {pageCount()}</b></Show>
				</div>
			</div>

			<div class="departures-columns" aria-hidden="true">
				<span class="departure-time">TIME</span>
				<span class="departure-destination">DESTINATION</span>
				<span class="departure-flight">FLIGHT</span>
				<span class="departure-terminal">TERMINAL</span>
				<span class="departure-gate">GATE</span>
				<span class="departure-status">STATUS</span>
			</div>

			<main class="departures-list">
				<Show
					when={currentRows().length > 0}
					fallback={(
						<div class="departures-empty">
							<strong>--</strong>
							<span>{settings().emptyStateText}</span>
						</div>
					)}
				>
					<For each={currentRows()}>
						{(row: DepartureRow): JSX.Element => (
							<article class="departure-row">
								<div class="departure-time"><strong>{row.scheduledTime}</strong></div>
								<div class="departure-destination">
									<strong>{row.destination}</strong>
									<span>{row.airline || 'Airline information pending'}</span>
								</div>
								<div class="departure-flight"><strong>{row.flight}</strong></div>
								<div class="departure-terminal"><strong>{row.terminal || '--'}</strong></div>
								<div class="departure-gate"><strong>{row.gate || '--'}</strong></div>
								<div class="departure-status">
									<span class={`departure-status--${row.statusTone}`}>{row.status}</span>
								</div>
							</article>
						)}
					</For>
				</Show>
			</main>

			<footer class="departures-footer">
				<span><i class="legend-dot legend-dot--boarding" />BOARDING</span>
				<span><i class="legend-dot legend-dot--gate" />GO TO GATE</span>
				<span><i class="legend-dot legend-dot--delayed" />DELAYED</span>
				<strong>PLEASE CHECK GATE INFORMATION REGULARLY</strong>
			</footer>
		</div>
	);
};
