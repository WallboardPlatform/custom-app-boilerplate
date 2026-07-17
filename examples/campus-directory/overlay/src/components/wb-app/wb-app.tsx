import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, untrack } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useDataSources } from '@hooks/system/useDataSources';
import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type {
	DirectoryDatasource,
	DirectoryDisplayEntry,
	DirectoryEntry
} from '@interfaces/directory.interface';

import { markDirectoryGroups, normalizeDirectoryRows } from '@utils/directory';
import { normalizeCircularIndex, pageAt, paginate } from '@utils/pagination';
import { createRotationController } from '@utils/rotation';
import { mixHexColors, readableTextColor } from '@utils/theme';

import style from '@components/wb-app/wb-app.module.scss';

import sampleDatasourceJson from '../../../sample-datasource.json';

interface Dimensions {
	width: number;
	height: number;
}

const sampleDatasource: DirectoryDatasource = sampleDatasourceJson;

const getRowsPerPage = (dimensions: Dimensions): number => {
	if (dimensions.height > dimensions.width * 1.18) {
		return dimensions.height >= 1600 ? 6 : 4;
	}

	if (dimensions.height <= 480) {
		return 3;
	}

	if (dimensions.height <= 650) {
		return 4;
	}

	if (dimensions.height <= 850) {
		return 6;
	}

	if (dimensions.height <= 1150) {
		return 8;
	}

	if (dimensions.height <= 1600) {
		return 10;
	}

	return 14;
};

const pluralize = (count: number, singular: string, plural: string): string => {
	return `${count} ${count === 1 ? singular : plural}`;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const fitDirectoryTitle = useAutoFitText({
		minFontSize: 20,
		maxFontSize: 58,
		widthOnly: true,
		watch: (): string => settings().directoryTitle
	});
	const [dimensions, setDimensions] = createSignal<Dimensions>({ width: 1920, height: 1080 });
	const [pageIndex, setPageIndex] = createSignal<number>(0);
	const rotation = createRotationController((_key: string, index: number): void => {
		setPageIndex(index);
	});
	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'directoryData');
	});
	const rawData: Accessor<unknown> = createMemo((): unknown => dataSources().directoryData?.value);
	const entries: Accessor<DirectoryEntry[]> = createMemo((): DirectoryEntry[] => {
		return normalizeDirectoryRows(hasBoundDatasource() ? rawData() : sampleDatasource);
	});
	const rowsPerPage: Accessor<number> = createMemo((): number => getRowsPerPage(dimensions()));
	const pages: Accessor<DirectoryEntry[][]> = createMemo((): DirectoryEntry[][] => {
		return paginate(entries(), rowsPerPage(), { balancePages: true });
	});
	const pageKeys: Accessor<string[]> = createMemo((): string[] => pages().map((page: DirectoryEntry[], index: number): string => {
		const first: DirectoryEntry | undefined = page[0];

		return first ? `${first.building}|${first.floor}|${first.department}|${first.room}` : `page-${index}`;
	}));
	const pageCount: Accessor<number> = createMemo((): number => Math.max(1, pages().length));
	const currentRows: Accessor<DirectoryEntry[]> = createMemo((): DirectoryEntry[] => {
		return pageAt(pages(), pageIndex());
	});
	const displayRows: Accessor<DirectoryDisplayEntry[]> = createMemo((): DirectoryDisplayEntry[] => {
		return markDirectoryGroups(currentRows());
	});
	const buildingCount: Accessor<number> = createMemo((): number => {
		return new Set(entries().map((entry: DirectoryEntry): string => entry.building)).size;
	});
	const visibleRange: Accessor<string> = createMemo((): string => {
		if (entries().length === 0) {
			return '0 / 0';
		}

		const normalizedPageIndex: number = normalizeCircularIndex(pageIndex(), pages().length);
		const start: number = pages()
			.slice(0, normalizedPageIndex)
			.reduce((total: number, page: DirectoryEntry[]): number => total + page.length, 0) + 1;
		const end: number = start + currentRows().length - 1;

		return `${start}-${end} / ${entries().length}`;
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => {
		const backgroundColor: string = settings().backgroundColor;
		const textColor: string = settings().textColor;
		const accentColor: string = settings().accentColor;
		const accessibilityColor: string = settings().accessibilityColor;

		return {
			'--directory-background': backgroundColor,
			'--directory-text': textColor,
			'--directory-accent': accentColor,
			'--directory-access': accessibilityColor,
			'--directory-secondary-accent': settings().secondaryAccentColor,
			'--directory-tertiary-accent': settings().tertiaryAccentColor,
			'--directory-on-accent': readableTextColor(accentColor),
			'--directory-on-access': readableTextColor(accessibilityColor),
			'--directory-surface': mixHexColors(backgroundColor, textColor, 0.045),
			'--directory-surface-strong': mixHexColors(backgroundColor, textColor, 0.085),
			'--directory-border': mixHexColors(backgroundColor, textColor, 0.19),
			'--directory-muted': mixHexColors(textColor, backgroundColor, 0.44),
			'--directory-locator': mixHexColors(backgroundColor, accentColor, 0.11),
			'--directory-route': mixHexColors(backgroundColor, settings().secondaryAccentColor, 0.1),
			'--directory-access-surface': mixHexColors(backgroundColor, accessibilityColor, 0.11)
		};
	});

	onMount((): void => {
		const updateDimensions = (width: number, height: number): void => {
			setDimensions({ width: Math.round(width), height: Math.round(height) });
		};
		const initialBounds: DOMRect = props.hostElement.getBoundingClientRect();
		const resizeObserver: ResizeObserver = new ResizeObserver((observedEntries: ResizeObserverEntry[]): void => {
			const observedEntry: ResizeObserverEntry | undefined = observedEntries[0];

			if (observedEntry) {
				updateDimensions(observedEntry.contentRect.width, observedEntry.contentRect.height);
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
			classList={{
				'directory--compact': dimensions().height <= 620,
				'directory--narrow': dimensions().width <= 700,
				'directory--portrait': dimensions().height > dimensions().width * 1.18
			}}
			data-host-ready={Boolean(props.hostElement)}
			data-page={pageIndex() + 1}
			data-page-duration={settings().pageDurationSeconds}
			data-theme={settings().themePreset}
			style={rootStyle()}
		>
			<header class="directory-header">
				<div class="directory-header-content">
					<div class="directory-mark" aria-hidden="true">
						<span>R</span>
						<i />
					</div>
					<div class="directory-brand-copy">
						<span class="directory-campus-name">{settings().campusName}</span>
						<h1 class="directory-title" ref={fitDirectoryTitle}>{settings().directoryTitle}</h1>
					</div>
					<div class="directory-meta">
						<span class="directory-meta-label">YOU ARE HERE</span>
						<strong class="directory-location">{settings().locationLabel}</strong>
						<span class="directory-summary">
							{pluralize(buildingCount(), 'BUILDING', 'BUILDINGS')} / {pluralize(entries().length, 'DESTINATION', 'DESTINATIONS')}
						</span>
					</div>
				</div>
				<div class="directory-route-stripe" aria-hidden="true">
					<span />
					<span />
					<span />
				</div>
			</header>

			<div class="directory-column-head" aria-hidden="true">
				<div class="directory-locator-head">
					<span>BUILDING</span>
					<span>FLOOR</span>
				</div>
				<div class="directory-row-content">
					<span class="directory-department">DEPARTMENT</span>
					<span class="directory-room">ROOM</span>
					<span class="directory-direction">DIRECTION</span>
					<span class="directory-accessibility">ACCESSIBILITY</span>
				</div>
			</div>

			<main class="directory-list">
				<Show
					when={displayRows().length > 0}
					fallback={(
						<div class="directory-empty">
							<div aria-hidden="true"><span>R</span></div>
							<strong>DIRECTORY UNAVAILABLE</strong>
							<p>{settings().emptyStateText}</p>
						</div>
					)}
				>
					<For each={displayRows()}>
						{(entry: DirectoryDisplayEntry): JSX.Element => (
							<article
								class="directory-row"
								classList={{
									'directory-row--building-start': entry.buildingStart,
									'directory-row--floor-start': entry.floorStart
								}}
							>
								<div class="directory-locator">
									<Show
										when={entry.buildingStart}
										fallback={<i class="directory-group-line" aria-hidden="true" />}
									>
										<strong class="directory-building">{entry.building}</strong>
									</Show>
									<span class="directory-floor">{entry.floor}</span>
								</div>
								<div class="directory-row-content">
									<div class="directory-department">
										<strong class="directory-department-name">{entry.department}</strong>
									</div>
									<div class="directory-room">
										<span>{entry.room || 'ROOM PENDING'}</span>
									</div>
									<div class="directory-direction">
										<b aria-hidden="true">&rarr;</b>
										<span class="directory-direction-text">{entry.direction}</span>
									</div>
									<div class="directory-accessibility">
										<Show
											when={entry.accessibilityNote}
											fallback={<span class="directory-accessibility-empty">STANDARD ROUTE</span>}
										>
											<b>ACCESS</b>
											<span class="directory-accessibility-note">{entry.accessibilityNote}</span>
										</Show>
									</div>
								</div>
							</article>
						)}
					</For>
				</Show>
			</main>

			<footer class="directory-footer">
				<div class="directory-progress" aria-hidden="true">
					<For each={pages().length > 0 ? pages() : [[]]}>
						{(_page: DirectoryEntry[], index: Accessor<number>): JSX.Element => (
							<span classList={{ 'is-active': index() === normalizeCircularIndex(pageIndex(), pageCount()) }} />
						)}
					</For>
				</div>
				<strong class="directory-range">DESTINATIONS {visibleRange()}</strong>
				<span class="directory-page-label">
					<Show when={pageCount() > 1} fallback="ALL DESTINATIONS">
						ROUTE PAGE {pageIndex() + 1} OF {pageCount()}
					</Show>
				</span>
			</footer>
		</section>
	);
};
