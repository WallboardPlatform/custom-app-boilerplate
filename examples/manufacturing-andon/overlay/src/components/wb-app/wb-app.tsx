import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import WbLineSection from '@components/wb-line-section/wb-line-section';
import WbStatusMarker from '@components/wb-status-marker/wb-status-marker';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type {
	AndonPage,
	AndonPageSection,
	AndonStation,
	AndonSummary,
	AndonTone
} from '@interfaces/andon.interface';

import {
	extractAndonRows,
	groupAndonLines,
	normalizeAndonRows,
	paginateAndonLines,
	summarizeAndonStations
} from '@utils/andon';
import { createRotationController } from '@utils/rotation';
import { mixHexColors, readableTextColor } from '@utils/theme';

import style from '@components/wb-app/wb-app.module.scss';

import sampleDatasourceJson from '../../../sample-datasource.json';

interface Dimensions {
	width: number;
	height: number;
}

const legendTones: AndonTone[] = ['normal', 'attention', 'stopped', 'unknown'];
const sampleDatasource: unknown = sampleDatasourceJson;

const toneLabel = (tone: AndonTone): string => {
	if (tone === 'normal') {
		return 'NORMAL';
	}

	if (tone === 'attention') {
		return 'ATTENTION';
	}

	if (tone === 'stopped') {
		return 'STOPPED';
	}

	return 'UNKNOWN';
};

const summaryHeadline = (summary: AndonSummary): string => {
	if (summary.stopped > 0) {
		return `${summary.stopped} STOPPED`;
	}

	if (summary.attention > 0) {
		return `${summary.attention} NEED ATTENTION`;
	}

	if (summary.unknown > 0) {
		return `${summary.unknown} UNVERIFIED`;
	}

	return summary.total > 0 ? 'FLOW STABLE' : 'NO STATUS DATA';
};

const summaryKicker = (summary: AndonSummary): string => {
	if (summary.stopped > 0) {
		return 'IMMEDIATE RESPONSE REQUIRED';
	}

	if (summary.attention > 0) {
		return 'ACTIVE EXCEPTIONS';
	}

	if (summary.unknown > 0) {
		return 'STATE VERIFICATION REQUIRED';
	}

	return summary.total > 0 ? 'ALL ACTIVE STATIONS NORMAL' : 'WAITING FOR TABLE ROWS';
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const fitBoardTitle = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 54,
		widthOnly: true,
		watch: (): string => settings().boardTitle
	});
	const [dimensions, setDimensions] = createSignal<Dimensions>({ width: 1080, height: 1920 });
	const [pageIndex, setPageIndex] = createSignal<number>(0);
	const rotation = createRotationController((_key: string, index: number): void => {
		setPageIndex(index);
	});
	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'andonData');
	});
	const rawRows: Accessor<unknown[]> = createMemo((): unknown[] => {
		const rawValue: unknown = hasBoundDatasource() ? dataSources().andonData?.value : sampleDatasource;

		return extractAndonRows(rawValue) ?? [];
	});
	const stations: Accessor<AndonStation[]> = createMemo((): AndonStation[] => normalizeAndonRows(rawRows()));
	const summary: Accessor<AndonSummary> = createMemo((): AndonSummary => summarizeAndonStations(stations()));
	const stationCapacity: Accessor<number> = createMemo((): number => 11);
	const pages: Accessor<AndonPage[]> = createMemo((): AndonPage[] => {
		return paginateAndonLines(groupAndonLines(stations()), stationCapacity());
	});
	const pageKeys: Accessor<string[]> = createMemo((): string[] => pages().map((page: AndonPage, index: number): string => {
		return page.sections[0]?.key ?? `page-${index}`;
	}));
	const pageCount: Accessor<number> = createMemo((): number => Math.max(1, pages().length));
	const currentPage: Accessor<AndonPage | undefined> = createMemo((): AndonPage | undefined => {
		return pages()[pageIndex() % pageCount()];
	});
	const currentSections: Accessor<AndonPageSection[]> = createMemo((): AndonPageSection[] => {
		return currentPage()?.sections ?? [];
	});
	const pageIndexes: Accessor<number[]> = createMemo((): number[] => {
		return Array.from({ length: pageCount() }, (_: unknown, index: number): number => index);
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => {
		const background: string = settings().backgroundColor;
		const surface: string = settings().surfaceColor;
		const primary: string = settings().primaryTextColor;

		return {
			'--andon-background': background,
			'--andon-surface': surface,
			'--andon-primary': primary,
			'--andon-muted': settings().secondaryTextColor,
			'--andon-normal': settings().normalColor,
			'--andon-attention': settings().attentionColor,
			'--andon-stopped': settings().stoppedColor,
			'--andon-unknown': settings().unknownColor,
			'--andon-on-normal': readableTextColor(settings().normalColor),
			'--andon-on-attention': readableTextColor(settings().attentionColor),
			'--andon-on-stopped': readableTextColor(settings().stoppedColor),
			'--andon-rule': mixHexColors(surface, primary, 0.18),
			'--andon-rule-strong': mixHexColors(surface, primary, 0.32),
			'--andon-line-header': mixHexColors(surface, primary, 0.045),
			'--andon-normal-soft': mixHexColors(surface, settings().normalColor, 0.075),
			'--andon-attention-soft': mixHexColors(surface, settings().attentionColor, 0.17),
			'--andon-stopped-soft': mixHexColors(surface, settings().stoppedColor, 0.2),
			'--andon-unknown-soft': mixHexColors(surface, settings().unknownColor, 0.12),
			'--andon-header-band': mixHexColors(background, primary, 0.055)
		};
	});

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

		updateDimensions(initialBounds.width, initialBounds.height);
		resizeObserver.observe(props.hostElement);

		onCleanup((): void => resizeObserver.disconnect());
	});

	createEffect((): void => {
		const keys: string[] = pageKeys();

		rotation.sync(keys, untrack((): string | undefined => keys[pageIndex()]), settings().pageDurationSeconds * 1000);
	});

	onCleanup((): void => rotation.destroy());

	return (
		<section
			class={`wb-app ${style['wb-app']}`}
			classList={{ 'andon--narrow': dimensions().width <= 600 }}
			data-host-ready={Boolean(props.hostElement)}
			data-page-count={pageCount()}
			data-page-current={pageIndex() + 1}
			data-summary-tone={summary().tone}
			style={rootStyle()}
		>
			<header class="andon-header">
				<div class="andon-brand">
					<div class="andon-brand__mark" aria-hidden="true">
						<span>N</span><i /><i /><i />
					</div>
					<div class="andon-brand__copy">
						<h1 ref={fitBoardTitle} class="andon-brand__name">{settings().boardTitle}</h1>
						<span class="andon-brand__subtitle">{settings().boardSubtitle}</span>
					</div>
					<div class="andon-live"><i />LIVE TABLE</div>
				</div>

				<div class="andon-summary">
					<div class="andon-summary__signal"><WbStatusMarker size="hero" tone={summary().tone} /></div>
					<div class="andon-summary__copy">
						<span>{summaryKicker(summary())}</span>
						<strong>{summaryHeadline(summary())}</strong>
						<small>{summary().total} ACTIVE STATIONS / {groupAndonLines(stations()).length} LINES</small>
					</div>
				</div>

				<div class="andon-metrics">
					<For each={legendTones}>
						{(tone: AndonTone): JSX.Element => (
							<div class="andon-metric" data-tone={tone}>
								<strong>{summary()[tone]}</strong><span>{toneLabel(tone)}</span>
							</div>
						)}
					</For>
				</div>
			</header>

			<main
				class="andon-body"
				classList={{
					'andon-body--sparse': Boolean(currentPage() && currentPage()!.stationCount <= 3)
				}}
			>
				<Show
					when={currentSections().length > 0}
					fallback={(
						<div class="andon-empty">
							<WbStatusMarker size="hero" tone="unknown" />
							<span>NO ACTIVE STATIONS</span>
							<strong class="andon-empty__message">{settings().emptyStateText}</strong>
						</div>
					)}
				>
					<For each={currentSections()}>
						{(section: AndonPageSection): JSX.Element => <WbLineSection section={section} />}
					</For>
					<Show when={currentPage() && currentPage()!.stationCount <= 3}>
						<div class="andon-sparse-tail">
							<span>ACTIVE STATUS WINDOW</span>
							<strong>{currentPage()!.stationCount} {currentPage()!.stationCount === 1 ? 'STATION' : 'STATIONS'} IN VIEW</strong>
							<small>END OF CURRENT TABLE ROWS</small>
							<i aria-hidden="true" />
						</div>
					</Show>
				</Show>
			</main>

			<footer class="andon-footer">
				<div class="andon-legend">
					<For each={legendTones}>
						{(tone: AndonTone): JSX.Element => (
							<span><WbStatusMarker size="legend" tone={tone} /><b>{toneLabel(tone)}</b></span>
						)}
					</For>
				</div>
				<div class="andon-pagination">
					<strong>{pageCount() > 1 ? `VIEW ${pageIndex() + 1} OF ${pageCount()}` : 'ALL ACTIVE LINES'}</strong>
					<div aria-hidden="true">
						<For each={pageIndexes()}>
							{(index: number): JSX.Element => <i data-active={index === pageIndex()} />}
						</For>
					</div>
				</div>
			</footer>
		</section>
	);
};
