import { createMemo, For, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type {
	PharmacyQueueDatasource,
	PharmacyQueueRow,
	PharmacyQueueView
} from '@interfaces/pharmacy-queue.interface';

import {
	buildQueueView,
	normalizeQueueRows,
	queueStateLabel,
	queueStateMark
} from '@utils/pharmacy-queue';

import style from '@components/wb-app/wb-app.module.scss';

import sampleDatasourceJson from '../../../sample-datasource.json';

const MAX_UPCOMING_ROWS = 3;
const sampleDatasource: PharmacyQueueDatasource = sampleDatasourceJson;

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'queueData');
	});
	const rows: Accessor<PharmacyQueueRow[]> = createMemo((): PharmacyQueueRow[] => {
		const value: unknown = hasBoundDatasource()
			? dataSources().queueData?.value
			: sampleDatasource;

		return normalizeQueueRows(value);
	});
	const queue: Accessor<PharmacyQueueView> = createMemo((): PharmacyQueueView => buildQueueView(rows()));
	const visibleUpcoming: Accessor<PharmacyQueueRow[]> = createMemo((): PharmacyQueueRow[] => {
		return queue().upcoming.slice(0, MAX_UPCOMING_ROWS);
	});
	const remainingCount: Accessor<number> = createMemo((): number => {
		return Math.max(0, queue().upcoming.length - MAX_UPCOMING_ROWS);
	});
	const hasQueueContent: Accessor<boolean> = createMemo((): boolean => {
		return Boolean(queue().hero || queue().upcoming.length > 0);
	});
	const prioritizesHero: Accessor<boolean> = createMemo((): boolean => {
		const hero: PharmacyQueueRow | undefined = queue().hero;

		return Boolean(hero && (hero.ticket.length > 12 || hero.counter.length > 22));
	});
	const hidesHeroNote: Accessor<boolean> = createMemo((): boolean => {
		return prioritizesHero();
	});
	const fitHeroTicket = useAutoFitText({
		minFontSize: 30,
		maxFontSize: 66,
		widthOnly: true,
		watch: (): string => queue().hero?.ticket ?? ''
	});
	const fitHeroCounter = useAutoFitText({
		minFontSize: 16,
		maxFontSize: 25,
		widthOnly: true,
		watch: (): string => queue().hero?.counter ?? ''
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--pharmacy-background': settings().backgroundColor,
		'--pharmacy-hero': settings().heroBackgroundColor,
		'--pharmacy-surface': settings().surfaceColor,
		'--pharmacy-primary': settings().primaryTextColor,
		'--pharmacy-secondary': settings().secondaryTextColor,
		'--pharmacy-accent': settings().accentColor,
		'--pharmacy-alert': settings().alertColor,
		'--pharmacy-hero-text': settings().heroTextColor,
		'--pharmacy-hero-muted': settings().heroMutedTextColor,
		'--pharmacy-divider': settings().dividerColor,
		'--pharmacy-accent-text': settings().accentTextColor,
		'--pharmacy-alert-text': settings().alertTextColor
	}));

	return (
		<section
			class={`wb-app ${style['wb-app']}`}
			data-host-ready={Boolean(props.hostElement)}
			data-theme={settings().themePreset}
			style={rootStyle()}
		>
			<header class="pharmacy-header">
				<div class="pharmacy-brand">
					<span class="pharmacy-brand__mark" aria-hidden="true" />
					<strong class="pharmacy-brand__name" title={settings().pharmacyName}>
						{settings().pharmacyName}
					</strong>
				</div>
				<span class="pharmacy-header__type">PICKUP QUEUE</span>
			</header>

			<Show
				when={hasQueueContent()}
				fallback={
					<main class="queue-empty">
						<span class="queue-empty__mark" aria-hidden="true" />
						<div>
							<strong>QUEUE CLEAR</strong>
							<p class="queue-empty__message">{settings().emptyStateText}</p>
						</div>
					</main>
				}
			>
				<main class="queue-board">
					<section
						class="queue-hero"
						classList={{
							'queue-hero--expanded': visibleUpcoming().length === 0 || prioritizesHero(),
							'queue-hero--idle': !queue().hero
						}}
						aria-live="polite"
					>
						<Show
							when={queue().hero}
							fallback={
								<>
									<div class="queue-hero__eyebrow">
										<span class="queue-hero__status">WAIT</span>
										<span>PLEASE WAIT</span>
									</div>
									<strong class="queue-hero__idle-title">No active call</strong>
									<p class="queue-hero__idle-copy">Watch the next queue for your ticket.</p>
								</>
							}
						>
							{(hero: Accessor<PharmacyQueueRow>): JSX.Element => (
								<>
									<div class="queue-hero__eyebrow">
										<span class="queue-hero__status">CALLED</span>
										<span>NOW SERVING</span>
									</div>
									<strong ref={fitHeroTicket} class="queue-hero__ticket" title={hero().ticket}>
										{hero().ticket}
									</strong>
									<div class="queue-hero__counter">
										<span class="queue-hero__arrow" aria-hidden="true">-&gt;</span>
										<div>
											<small>GO TO</small>
											<strong
												ref={fitHeroCounter}
												class="queue-hero__counter-value"
												title={hero().counter}
											>
												{hero().counter}
											</strong>
										</div>
									</div>
									<p
										class="queue-hero__note"
										classList={{ 'queue-hero__note--hidden': hidesHeroNote() }}
										title={hero().note}
									>
										{hero().note || 'Please proceed to the counter.'}
									</p>
								</>
							)}
						</Show>
					</section>

					<Show when={visibleUpcoming().length > 0 && !prioritizesHero()}>
						<section class="queue-next" aria-label="Next pickup tickets">
							<header class="queue-next__header">
								<strong>NEXT UP</strong>
								<span>{queue().upcoming.length} WAITING</span>
							</header>
							<div class="queue-next__rows">
								<For each={visibleUpcoming()}>
									{(row: PharmacyQueueRow, index: Accessor<number>): JSX.Element => (
										<article class="queue-row" data-state={row.state}>
											<span class="queue-row__position">{index() + 1}</span>
											<div class="queue-row__content">
												<strong class="queue-row__ticket" title={row.ticket}>{row.ticket}</strong>
												<div class="queue-row__meta">
													<span class="queue-row__counter" title={row.counter}>{row.counter}</span>
													<span class="queue-row__state">
														<b aria-hidden="true">{queueStateMark(row.state)}</b>
														{queueStateLabel(row.state)}
													</span>
												</div>
											</div>
										</article>
									)}
								</For>
							</div>
							<Show when={remainingCount() > 0}>
								<footer class="queue-more">+{remainingCount()} MORE WAITING</footer>
							</Show>
						</section>
					</Show>
				</main>
			</Show>
		</section>
	);
};
