import { createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { AgendaEvent, AgendaSource } from '@interfaces/agenda.interface';
import type { DataSources, Settings } from '@interfaces/application.interface';

import style from '@components/wb-app/wb-app.module.scss';

interface AgendaModel {
	events: AgendaEvent[];
	source: AgendaSource;
}

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

const toText = (value: unknown): string => {
	return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
};

const toTimestamp = (value: unknown): number | undefined => {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	const text: string = toText(value);

	if (!text) {
		return undefined;
	}

	const numericValue: number = Number(text);

	if (Number.isFinite(numericValue) && numericValue > 0) {
		return numericValue;
	}

	const parsedDate: number = Date.parse(text);

	return Number.isFinite(parsedDate) ? parsedDate : undefined;
};

const readNestedTime = (value: unknown): number | undefined => {
	if (!isRecord(value)) {
		return toTimestamp(value);
	}

	return toTimestamp(value.timeStamp) ?? toTimestamp(value.dateTime) ?? toTimestamp(value.date);
};

const extractRows = (rawValue: unknown): { rows: unknown[]; source: AgendaSource } => {
	const value: unknown = parseValue(rawValue);

	if (Array.isArray(value)) {
		return { rows: value, source: 'unknown' };
	}

	if (!isRecord(value)) {
		return { rows: [], source: 'unknown' };
	}

	if (Array.isArray(value.events)) {
		const firstRow: unknown = value.events[0];
		const source: AgendaSource = isRecord(firstRow) && ('startTimestamp' in firstRow || 'summary' in firstRow)
			? 'icalendar'
			: 'google-or-microsoft';

		return { rows: value.events, source };
	}

	if (isRecord(value.calendar) && Array.isArray(value.calendar.events)) {
		return { rows: value.calendar.events, source: 'icalendar' };
	}

	return { rows: [], source: 'unknown' };
};

const normalizeCalendar = (rawValue: unknown): AgendaModel => {
	const extracted = extractRows(rawValue);
	const events: AgendaEvent[] = extracted.rows
		.map((rawRow: unknown, index: number): AgendaEvent | undefined => {
			if (!isRecord(rawRow)) {
				return undefined;
			}

			const title: string = toText(rawRow.title) || toText(rawRow.summary) || toText(rawRow.subject);
			const start: number | undefined = readNestedTime(rawRow.start) ?? toTimestamp(rawRow.startTimestamp);
			const end: number | undefined = readNestedTime(rawRow.end) ?? toTimestamp(rawRow.endTimestamp);
			const status: string = toText(rawRow.status).toLowerCase();

			if (!title || start === undefined || end === undefined || end <= start || status === 'cancelled') {
				return undefined;
			}

			return {
				id: toText(rawRow.id) || `${start}-${index}`,
				title,
				description: toText(rawRow.description),
				location: toText(rawRow.location),
				start,
				end,
				isAllDay: rawRow.isAllDay === true
			};
		})
		.filter((event: AgendaEvent | undefined): event is AgendaEvent => Boolean(event))
		.sort((left: AgendaEvent, right: AgendaEvent): number => left.start - right.start);

	return { events, source: extracted.source };
};

const formatTime = (timestamp: number, settings: Settings): string => {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		hour12: settings.timeFormat === '12h'
	});
};

const formatDate = (date: Date): string => {
	return date.toLocaleDateString([], {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
};

const eventTime = (event: AgendaEvent, settings: Settings): string => {
	return event.isAllDay ? 'All day' : `${formatTime(event.start, settings)} - ${formatTime(event.end, settings)}`;
};

const relativeStart = (event: AgendaEvent, now: number): string => {
	const minutes: number = Math.max(0, Math.ceil((event.start - now) / 60000));

	if (minutes === 0) {
		return 'Starting now';
	}

	if (minutes < 60) {
		return `In ${minutes} min`;
	}

	const hours: number = Math.floor(minutes / 60);
	const remainder: number = minutes % 60;

	return remainder === 0 ? `In ${hours} hr` : `In ${hours} hr ${remainder} min`;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [now, setNow] = createSignal<Date>(new Date());
	const agenda: Accessor<AgendaModel> = createMemo((): AgendaModel => {
		return normalizeCalendar(dataSources().calendarData?.value);
	});
	const activeEvent: Accessor<AgendaEvent | undefined> = createMemo((): AgendaEvent | undefined => {
		const timestamp: number = now().getTime();

		return agenda().events.find((event: AgendaEvent): boolean => event.start <= timestamp && event.end > timestamp);
	});
	const featuredEvent: Accessor<AgendaEvent | undefined> = createMemo((): AgendaEvent | undefined => {
		const timestamp: number = now().getTime();

		return activeEvent() ?? agenda().events.find((event: AgendaEvent): boolean => event.start >= timestamp);
	});
	const upcomingEvents: Accessor<AgendaEvent[]> = createMemo((): AgendaEvent[] => {
		const timestamp: number = now().getTime();
		const featuredId: string | undefined = featuredEvent()?.id;

		return agenda().events
			.filter((event: AgendaEvent): boolean => event.end > timestamp && event.id !== featuredId)
			.slice(0, settings().maxUpcoming);
	});
	const progress: Accessor<number> = createMemo((): number => {
		const event: AgendaEvent | undefined = activeEvent();

		if (!event) {
			return 0;
		}

		return Math.max(0, Math.min(100, ((now().getTime() - event.start) / (event.end - event.start)) * 100));
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--agenda-background': settings().backgroundColor,
		'--agenda-panel': settings().panelColor,
		'--agenda-primary': settings().primaryTextColor,
		'--agenda-secondary': settings().secondaryTextColor,
		'--agenda-accent': settings().accentColor,
		'--agenda-live': settings().liveColor
	}));

	onMount((): void => {
		const timer: number = window.setInterval((): void => {
			setNow(new Date());
		}, 15000);

		onCleanup((): void => window.clearInterval(timer));
	});

	return (
		<section
			class={`wb-app ${style['wb-app']}`}
			style={rootStyle()}
			data-calendar-source={agenda().source}
			data-show-clock={settings().showClock ? 'true' : 'false'}
			data-host-ready={Boolean(props.hostElement)}
		>
			<header class="agenda-header">
				<div class="agenda-heading">
					<span class="venue-name">{settings().venueName}</span>
					<h1>{settings().boardTitle}</h1>
				</div>
				<div class="agenda-date">
					<span>{formatDate(now())}</span>
					<Show when={settings().showClock}>
						<strong class="agenda-clock">{formatTime(now().getTime(), settings())}</strong>
					</Show>
				</div>
			</header>

			<Show
				when={featuredEvent()}
				fallback={<div class="agenda-empty">{settings().emptyStateText}</div>}
			>
				{(featured: Accessor<AgendaEvent>): JSX.Element => (
					<div class="agenda-body">
						<article class="agenda-featured" data-active={activeEvent()?.id === featured().id ? 'true' : 'false'}>
							<div class="featured-status">
								<i />
								<span>{activeEvent()?.id === featured().id ? 'Now' : 'Next'}</span>
							</div>
							<div class="featured-content">
								<span class="featured-time">{eventTime(featured(), settings())}</span>
								<h2 class="featured-title">{featured().title}</h2>
								<Show when={featured().description}>
									<p>{featured().description}</p>
								</Show>
							</div>
							<div class="featured-footer">
								<span>{featured().location || 'Location to be announced'}</span>
								<strong>{activeEvent()?.id === featured().id ? 'In progress' : relativeStart(featured(), now().getTime())}</strong>
							</div>
							<Show when={activeEvent()?.id === featured().id}>
								<div class="event-progress"><i style={{ width: `${progress()}%` }} /></div>
							</Show>
						</article>

						<section class="agenda-upcoming">
							<div class="upcoming-header">
								<h3>{settings().upcomingTitle}</h3>
								<span>{upcomingEvents().length} events</span>
							</div>
							<div class="upcoming-list">
								<For each={upcomingEvents()}>
									{(event: AgendaEvent): JSX.Element => (
										<article class="upcoming-event">
											<div class="upcoming-time">
												<strong>{event.isAllDay ? 'ALL' : formatTime(event.start, settings())}</strong>
												<span>{event.isAllDay ? 'DAY' : formatTime(event.end, settings())}</span>
											</div>
											<div class="upcoming-copy">
												<h4>{event.title}</h4>
												<span>{event.location || 'Location to be announced'}</span>
											</div>
											<i class="timeline-dot" />
										</article>
									)}
								</For>
							</div>
						</section>
					</div>
				)}
			</Show>
		</section>
	);
};
