import {
	createEffect,
	createMemo,
	createSignal,
	For,
	onCleanup,
	onMount,
	Show,
	untrack
} from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useAutoFitText } from '@hooks/system/useAutoFitText';
import { useDataSources } from '@hooks/system/useDataSources';
import { useSettings } from '@hooks/system/useSettings';

import type { DataSources, Settings } from '@interfaces/application.interface';
import type { Recognition } from '@interfaces/recognition.interface';

import { createRotationController } from '@utils/rotation';

import { pageAt, paginate } from '@utils/pagination';
import {
	extractRecognitionRows,
	normalizeRecognitionRows,
	SAMPLE_RECOGNITIONS
} from '@utils/recognition';

import WbRecognitionCard from '@components/wb-recognition-card/wb-recognition-card';

import style from '@components/wb-app/wb-app.module.scss';

type LayoutMode = 'compact' | 'landscape' | 'wide' | 'portrait' | 'square';

const layoutModeFor = (width: number, height: number): LayoutMode => {
	const ratio: number = height > 0 ? width / height : 1;

	if (ratio >= 2.4) {
		return 'wide';
	}

	if (ratio <= 0.78) {
		return 'portrait';
	}

	if (width <= 760 && height <= 760) {
		return 'square';
	}

	if (width <= 1100 && height <= 700) {
		return 'compact';
	}

	return 'landscape';
};

const pageCapacityFor = (layoutMode: LayoutMode): number => {
	if (layoutMode === 'wide' || layoutMode === 'portrait') {
		return 4;
	}

	return layoutMode === 'square' || layoutMode === 'compact' ? 2 : 5;
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	let rootElement: HTMLDivElement | undefined;
	let resizeObserver: ResizeObserver | undefined;
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const [layoutMode, setLayoutMode] = createSignal<LayoutMode>('landscape');
	const [pageIndex, setPageIndex] = createSignal<number>(0);
	const rotation = createRotationController((_key: string, index: number): void => {
		setPageIndex(index);
	});
	const fitStudioName = useAutoFitText({
		minFontSize: 14,
		maxFontSize: 28,
		widthOnly: true,
		watch: (): string => settings().studioName
	});
	const fitWallTitle = useAutoFitText({
		minFontSize: 18,
		maxFontSize: 56,
		widthOnly: true,
		watch: (): string => settings().wallTitle
	});
	const hasBoundDatasource: Accessor<boolean> = createMemo((): boolean => {
		return Object.prototype.hasOwnProperty.call(dataSources(), 'recognitionData');
	});
	const recognitions: Accessor<Recognition[]> = createMemo((): Recognition[] => {
		if (!hasBoundDatasource()) {
			return SAMPLE_RECOGNITIONS;
		}

		const rawRows: unknown[] = extractRecognitionRows(dataSources().recognitionData?.value) ?? [];

		return normalizeRecognitionRows(rawRows);
	});
	const pageCapacity: Accessor<number> = createMemo((): number => pageCapacityFor(layoutMode()));
	const pages: Accessor<Recognition[][]> = createMemo((): Recognition[][] => {
		return paginate(recognitions(), pageCapacity(), { balancePages: true });
	});
	const pageKeys: Accessor<string[]> = createMemo((): string[] => pages().map((page: Recognition[], index: number): string => {
		return page[0]?.id ?? `page-${index}`;
	}));
	const pageCount: Accessor<number> = createMemo((): number => Math.max(1, pages().length));
	const currentRecognitions: Accessor<Recognition[]> = createMemo((): Recognition[] => {
		return pageAt(pages(), pageIndex());
	});
	const supportRecognitions: Accessor<Recognition[]> = createMemo((): Recognition[] => {
		return currentRecognitions().slice(1);
	});
	const firstVisiblePosition: Accessor<number> = createMemo((): number => {
		const previousPageSize: number = pages()[0]?.length ?? 0;

		return pageIndex() * previousPageSize + 1;
	});
	const finalVisiblePosition: Accessor<number> = createMemo((): number => {
		return Math.min(recognitions().length, firstVisiblePosition() + currentRecognitions().length - 1);
	});
	const rootStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => ({
		'--recognition-background': settings().backgroundColor,
		'--recognition-surface': settings().surfaceColor,
		'--recognition-text': settings().textColor,
		'--recognition-muted': settings().mutedTextColor,
		'--recognition-accent': settings().accentColor,
		'--recognition-highlight': settings().highlightColor,
		'--recognition-cool': settings().coolColor,
		'--recognition-surface-ink': settings().surfaceInkColor,
		'--recognition-accent-ink': settings().accentInkColor,
		'--recognition-highlight-ink': settings().highlightInkColor,
		'--recognition-cool-ink': settings().coolInkColor
	}));

	onMount((): void => {
		if (!rootElement) {
			return;
		}

		const updateLayout = (): void => {
			if (!rootElement) {
				return;
			}

			const bounds: DOMRect = rootElement.getBoundingClientRect();

			setLayoutMode(layoutModeFor(bounds.width, bounds.height));
		};

		resizeObserver = new ResizeObserver(updateLayout);
		resizeObserver.observe(rootElement);
		updateLayout();
	});

	createEffect((): void => {
		const keys: string[] = pageKeys();

		rotation.sync(keys, untrack((): string | undefined => keys[pageIndex()]), settings().pageDurationSeconds * 1000);
	});

	onCleanup((): void => rotation.destroy());
	onCleanup((): void => resizeObserver?.disconnect());

	return (
		<div
			ref={(element: HTMLDivElement): HTMLDivElement => rootElement = element}
			class={`wb-app ${style['wb-app']}`}
			data-host-ready={Boolean(props.hostElement)}
			data-layout={layoutMode()}
			data-page-count={pageCount()}
			data-page-index={pageIndex()}
			data-show-quotes={String(settings().showQuotes)}
			data-visible-count={currentRecognitions().length}
			style={rootStyle()}
		>
			<div class="recognition-stage">
				<header class="recognition-intro">
					<div class="recognition-mark" aria-hidden="true">
						<i /><i /><i />
					</div>
					<div class="recognition-intro__copy">
						<span class="recognition-brand" ref={fitStudioName}>{settings().studioName}</span>
						<h1 class="recognition-title" ref={fitWallTitle}>{settings().wallTitle}</h1>
						<p>Big work, seen.</p>
					</div>
					<Show when={recognitions().length > 0}>
						<div class="recognition-folio" aria-label={`Showing ${firstVisiblePosition()} to ${finalVisiblePosition()} of ${recognitions().length}`}>
							<span>{String(firstVisiblePosition()).padStart(2, '0')}</span>
							<i />
							<span>{String(finalVisiblePosition()).padStart(2, '0')}</span>
							<small>of {String(recognitions().length).padStart(2, '0')}</small>
						</div>
					</Show>
				</header>

				<main class="recognition-board">
					<Show
						when={currentRecognitions().length > 0}
						fallback={(
							<section class="recognition-empty">
								<div class="recognition-empty__shape" aria-hidden="true"><i /><i /><i /></div>
								<span>Next up</span>
								<h2>{settings().emptyStateText}</h2>
							</section>
						)}
					>
						<div class="recognition-cards">
							<WbRecognitionCard
								recognition={currentRecognitions()[0]}
								position={firstVisiblePosition() - 1}
								lead
								showQuote={settings().showQuotes}
							/>
							<Show when={supportRecognitions().length > 0}>
								<div class="recognition-support" data-support-count={supportRecognitions().length}>
									<For each={supportRecognitions()}>
										{(recognition: Recognition, index: Accessor<number>): JSX.Element => (
											<WbRecognitionCard
												recognition={recognition}
												position={firstVisiblePosition() + index()}
												showQuote={settings().showQuotes}
											/>
										)}
									</For>
								</div>
							</Show>
						</div>
					</Show>
				</main>
			</div>
		</div>
	);
};
