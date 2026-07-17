import { createEffect, createMemo, createSignal, onCleanup, onMount, Show, untrack } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { CalendarModel, FeedModel, VenueAnnouncement, VenueProgram } from '@interfaces/venue-pulse.interface';

import { createRotationController } from '@utils/rotation';
import { normalizeCalendar, normalizeFeed } from '@utils/venue-pulse';

import style from '@components/wb-app/wb-app.module.scss';

type ProgramState = 'now' | 'next';

interface FeaturedProgram {
	program: VenueProgram;
	state: ProgramState;
}

const formatTime = (timestamp: number, settings: Settings): string => {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: 'numeric',
		minute: '2-digit',
		hour12: settings.timeFormat === '12h'
	});
};

const formatDate = (timestamp: number): string => {
	return new Date(timestamp).toLocaleDateString([], {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
};

const formatPublished = (timestamp: number | undefined): string => {
	if (timestamp === undefined) {
		return '';
	}

	return new Date(timestamp).toLocaleDateString([], {
		month: 'short',
		day: 'numeric'
	});
};

const programTime = (program: VenueProgram, settings: Settings): string => {
	return program.isAllDay ? 'All day' : `${formatTime(program.start, settings)} - ${formatTime(program.end, settings)}`;
};

const relativeLabel = (program: VenueProgram, now: number): string => {
	const minutes: number = Math.max(0, Math.ceil((program.start - now) / 60000));

	if (minutes === 0) {
		return 'Starting now';
	}

	if (minutes < 60) {
		return `Starts in ${minutes} min`;
	}

	const hours: number = Math.floor(minutes / 60);
	const remainder: number = minutes % 60;

	return remainder === 0 ? `Starts in ${hours} hr` : `Starts in ${hours} hr ${remainder} min`;
};

const supportingLabel = (program: VenueProgram, state: ProgramState, now: number): string => {
	return state === 'now' ? 'In progress' : relativeLabel(program, now);
};

const progressPercent = (program: VenueProgram, state: ProgramState, now: number): number => {
	if (state !== 'now') {
		return 0;
	}

	return Math.max(0, Math.min(100, ((now - program.start) / (program.end - program.start)) * 100));
};

const programCandidates = (programs: VenueProgram[], now: number): FeaturedProgram[] => {
	const current: FeaturedProgram[] = programs
		.filter((program: VenueProgram): boolean => program.start <= now && program.end > now)
		.map((program: VenueProgram): FeaturedProgram => ({ program, state: 'now' }));

	if (current.length > 0) {
		return current;
	}

	return programs
		.filter((program: VenueProgram): boolean => program.end > now)
		.slice(0, 3)
		.map((program: VenueProgram): FeaturedProgram => ({ program, state: 'next' }));
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [now, setNow] = createSignal<Date>(new Date());
	const [programIndex, setProgramIndex] = createSignal(0);
	const [imageFailed, setImageFailed] = createSignal(false);
	const rotation = createRotationController((_key: string, index: number): void => {
		setProgramIndex(index);
	});
	const fitProgramTitle = useAutoFitText({
		minFontSize: 26,
		maxFontSize: 82,
		widthOnly: false,
		watch: (): string => featuredProgram()?.program.title ?? ''
	});

	const calendar: Accessor<CalendarModel> = createMemo((): CalendarModel => normalizeCalendar(dataSources().calendarData?.value));
	const feed: Accessor<FeedModel> = createMemo((): FeedModel => {
		return normalizeFeed(dataSources().feedData?.value, now().getTime(), settings().announcementFreshHours);
	});
	const candidates: Accessor<FeaturedProgram[]> = createMemo((): FeaturedProgram[] => {
		return programCandidates(calendar().programs, now().getTime());
	});
	const programKeys: Accessor<string[]> = createMemo((): string[] => {
		return candidates().map((item: FeaturedProgram): string => item.program.id);
	});
	const featuredProgram: Accessor<FeaturedProgram | undefined> = createMemo((): FeaturedProgram | undefined => {
		const items: FeaturedProgram[] = candidates();

		return items.length > 0 ? items[programIndex() % items.length] : undefined;
	});
	const announcement: Accessor<VenueAnnouncement | undefined> = createMemo((): VenueAnnouncement | undefined => {
		return feed().announcements[0];
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--wb-civic-venue-pulse-background': settings().backgroundColor,
		'--wb-civic-venue-pulse-surface': settings().surfaceColor,
		'--wb-civic-venue-pulse-primary': settings().primaryTextColor,
		'--wb-civic-venue-pulse-secondary': settings().secondaryTextColor,
		'--wb-civic-venue-pulse-accent': settings().accentColor,
		'--wb-civic-venue-pulse-soft-accent': settings().softAccentColor
	}));

	createEffect((): void => {
		const keys: string[] = programKeys();

		rotation.sync(keys, untrack((): string | undefined => keys[programIndex()]), settings().programRotationSeconds * 1000);
	});

	onCleanup((): void => rotation.destroy());

	createEffect((): void => {
		setImageFailed(Boolean(announcement()?.id) && false);
	});

	onMount((): void => {
		const timer: number = window.setInterval((): void => {
			setNow(new Date());
		}, 15000);

		onCleanup((): void => window.clearInterval(timer));
	});

	return (
		<section
			class={`wb-civic-venue-pulse ${style['wb-civic-venue-pulse']}`}
			data-preview-id="venue-pulse-root"
			data-host-ready={Boolean(props.hostElement)}
			data-calendar-source={calendar().source}
			data-feed-source={feed().source}
			data-program-count={candidates().length}
			data-program-index={programIndex()}
			data-rotation-seconds={settings().programRotationSeconds}
			data-media-enabled={settings().showMedia ? 'true' : 'false'}
			style={rootStyle()}
		>
			<header class="wb-civic-venue-pulse-header">
				<div>
					<span class="wb-civic-venue-pulse-venue-name">{settings().venueName}</span>
					<strong class="wb-civic-venue-pulse-board-label">{settings().boardLabel}</strong>
				</div>
				<time>{formatDate(now().getTime())}</time>
			</header>

			<Show
				when={featuredProgram() || announcement()}
				fallback={<div class="wb-civic-venue-pulse-empty">{settings().emptyStateText}</div>}
			>
				<div class="wb-civic-venue-pulse-stage">
					<Show
						when={featuredProgram()}
						fallback={
							<section class="wb-civic-venue-pulse-announcement-only">
								<span class="wb-civic-venue-pulse-state-label">Venue note</span>
								<h1 class="wb-civic-venue-pulse-announcement-title">{announcement()?.title}</h1>
								<p>{announcement()?.summary}</p>
							</section>
						}
					>
						{(featured: Accessor<FeaturedProgram>): JSX.Element => (
							<article class="wb-civic-venue-pulse-program-panel" data-state={featured().state}>
								<div class="wb-civic-venue-pulse-program-meta">
									<span class="wb-civic-venue-pulse-state-label">{featured().state === 'now' ? 'Now' : 'Next'}</span>
									<span class="wb-civic-venue-pulse-program-time">{programTime(featured().program, settings())}</span>
								</div>
								<h1 class="wb-civic-venue-pulse-program-title" ref={fitProgramTitle}>{featured().program.title}</h1>
								<Show when={featured().program.summary}>
									<p class="wb-civic-venue-pulse-program-summary">{featured().program.summary}</p>
								</Show>
								<footer class="wb-civic-venue-pulse-program-footer">
									<span>{featured().program.location || 'Location to be announced'}</span>
									<strong>{supportingLabel(featured().program, featured().state, now().getTime())}</strong>
								</footer>
								<Show when={featured().state === 'now'}>
									<div class="wb-civic-venue-pulse-program-progress">
										<i style={{ width: `${progressPercent(featured().program, featured().state, now().getTime())}%` }} />
									</div>
								</Show>
							</article>
						)}
					</Show>

					<Show when={featuredProgram() ? announcement() : undefined}>
						{(item: Accessor<VenueAnnouncement>): JSX.Element => (
							<aside class="wb-civic-venue-pulse-announcement-panel">
								<div class="wb-civic-venue-pulse-announcement-copy">
									<span>{item().category}</span>
									<h2 class="wb-civic-venue-pulse-announcement-title">{item().title}</h2>
									<Show when={item().summary}>
										<p>{item().summary}</p>
									</Show>
									<Show when={formatPublished(item().publishedAt)}>
										<time>{formatPublished(item().publishedAt)}</time>
									</Show>
								</div>
								<Show when={settings().showMedia && item().imageUrl && !imageFailed()}>
									<div class="wb-civic-venue-pulse-announcement-media" data-media-state="image">
										<img
											src={item().imageUrl}
											alt={item().title}
											onError={(): void => {
												setImageFailed(true);
											}}
										/>
									</div>
								</Show>
							</aside>
						)}
					</Show>
				</div>
			</Show>
		</section>
	);
};
