import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { PdfDocumentStore } from './document-store';
import { calculatePdfPageLayout } from './layout';
import { downloadPdfBytes } from './link-service';
import PdfPage from './pdf-page';
import type {
	LoadedPdfCollection,
	PdfInteractionEvent,
	PdfOutlineItem,
	PdfPageDescriptor,
	PdfPageLayout,
	PdfSearchMatch,
	PdfSource,
	PdfViewerController,
	PdfViewerOptions,
	PdfViewerState
} from './types';

import style from './pdf-viewer.module.scss';

export interface PdfViewerProps {
	class?: string;
	onController?(controller: PdfViewerController): void;
	onInteraction?(event: PdfInteractionEvent): void;
	onStateChange?(state: PdfViewerState): void;
	options: PdfViewerOptions;
	sources: PdfSource[];
}

const clamp = (value: number, minimum: number, maximum: number): number => {
	return Math.min(maximum, Math.max(minimum, value));
};

const equalPageSets = (left: Set<string>, right: Set<string>): boolean => {
	return left.size === right.size && Array.from(left).every((id: string): boolean => right.has(id));
};

const sourceSignature = (sources: PdfSource[]): string => {
	return sources
		.map((source: PdfSource): string => [source.id, source.url, source.password ?? ''].join('|'))
		.join('::');
};

const collectFormValues = (root: HTMLElement): Record<string, string | string[]> => {
	const values: Record<string, string | string[]> = {};
	const controls = root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
		'input, select, textarea'
	);

	for (const control of Array.from(controls)) {
		const key: string = control.name || control.getAttribute('data-element-id') || control.id;

		if (!key || (control instanceof HTMLInputElement && ['button', 'submit'].includes(control.type))) continue;

		if (control instanceof HTMLInputElement && (control.type === 'checkbox' || control.type === 'radio')) {
			if (!control.checked) continue;
			const existing: string | string[] | undefined = values[key];

			if (existing === undefined) values[key] = control.value || 'true';
			else values[key] = Array.isArray(existing) ? [...existing, control.value] : [existing, control.value];
		} else if (control instanceof HTMLSelectElement && control.multiple) {
			values[key] = Array.from(control.selectedOptions).map((option: HTMLOptionElement): string => option.value);
		} else {
			values[key] = control.value;
		}
	}

	return values;
};

export default (props: PdfViewerProps): JSX.Element => {
	const store = new PdfDocumentStore();
	let viewport!: HTMLDivElement;
	const formValues = new Map<string, string | string[]>();
	const pageElements = new Map<string, HTMLDivElement>();
	const [collection, setCollection] = createSignal<LoadedPdfCollection>();
	const [containerSize, setContainerSize] = createSignal({ height: 1, width: 1 });
	const [currentIndex, setCurrentIndex] = createSignal(0);
	const [error, setError] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [searchIndex, setSearchIndex] = createSignal(-1);
	const [searchMatches, setSearchMatches] = createSignal<PdfSearchMatch[]>([]);
	const [searchQuery, setSearchQuery] = createSignal('');
	const [searching, setSearching] = createSignal(false);
	const [visiblePageIds, setVisiblePageIds] = createSignal<Set<string>>(new Set());
	const [zoom, setZoom] = createSignal(1);
	let renderGeneration = 0;
	let scrollFrame: number | undefined;
	let autoScrollFrame: number | undefined;
	let autoScrollLastTime = 0;
	let autoScrollPauseStarted = 0;
	let autoScrollRewindStarted = 0;
	let autoScrollRewindOrigin = 0;
	let autoScrollPhase: 'end-pause' | 'rewind' | 'scroll' = 'scroll';
	let hoverPaused = false;

	const allPages: Accessor<PdfPageDescriptor[]> = createMemo((): PdfPageDescriptor[] => collection()?.pages ?? []);
	const pages: Accessor<PdfPageDescriptor[]> = createMemo((): PdfPageDescriptor[] => {
		const start: number = Math.max(1, Math.round(props.options.pageStart || 1));
		const requestedEnd: number = Math.round(props.options.pageEnd || 0);
		const end: number = requestedEnd > 0 ? requestedEnd : allPages().length;

		return allPages().filter((page: PdfPageDescriptor): boolean => {
			const number: number = page.globalIndex + 1;

			return number >= start && number <= end;
		});
	});
	const layouts: Accessor<PdfPageLayout[]> = createMemo((): PdfPageLayout[] => {
		return pages().map((page: PdfPageDescriptor): PdfPageLayout =>
			calculatePdfPageLayout(page, containerSize().width, containerSize().height, props.options, zoom())
		);
	});
	const currentPage: Accessor<PdfPageDescriptor | undefined> = createMemo(() => pages()[currentIndex()]);
	const renderedPages: Accessor<PdfPageDescriptor[]> = createMemo((): PdfPageDescriptor[] => {
		if (props.options.pageMode === 'single') {
			const current: PdfPageDescriptor | undefined = currentPage();

			return current ? [current] : [];
		}

		return pages();
	});
	const pageLayout = (descriptor: PdfPageDescriptor): PdfPageLayout => {
		const index: number = pages().findIndex((page: PdfPageDescriptor): boolean => page.id === descriptor.id);

		return layouts()[Math.max(0, index)];
	};
	const isPageActive = (descriptor: PdfPageDescriptor): boolean => {
		return props.options.pageMode === 'single' || visiblePageIds().has(descriptor.id);
	};
	const state: Accessor<PdfViewerState> = createMemo((): PdfViewerState => ({
		currentDocumentIndex: currentPage()?.documentIndex ?? 0,
		currentDocumentName: currentPage()?.documentName ?? '',
		currentDocumentPage: currentPage()?.pageNumber ?? 0,
		currentPage: currentIndex() + 1,
		documentCount: collection()?.documents.length ?? 0,
		documents: collection()?.sources ?? [],
		error: error(),
		loading: loading(),
		outlines: collection()?.outlines ?? [],
		pageCount: pages().length,
		pagesInCurrentDocument: currentPage()
			? allPages().filter((page: PdfPageDescriptor): boolean => page.documentIndex === currentPage()?.documentIndex).length
			: 0,
		searchIndex: searchIndex(),
		searchMatches: searchMatches(),
		searchQuery: searchQuery(),
		searching: searching(),
		zoom: zoom()
	}));

	const emitPageChange = (): void => {
		const page: PdfPageDescriptor | undefined = currentPage();

		if (!page) return;

		props.onInteraction?.({
			documentIndex: page.documentIndex,
			documentName: page.documentName,
			pageNumber: page.pageNumber,
			type: 'page-change',
			value: { globalPage: currentIndex() + 1 }
		});
	};

	const scrollToIndex = (requestedIndex: number): void => {
		const nextIndex: number = clamp(Math.round(requestedIndex), 0, Math.max(0, pages().length - 1));
		setCurrentIndex(nextIndex);
		const descriptor: PdfPageDescriptor | undefined = pages()[nextIndex];

		if (props.options.pageMode === 'continuous' && descriptor) {
			const element: HTMLDivElement | undefined = pageElements.get(descriptor.id);

			if (element) {
				if (props.options.scrollDirection === 'horizontal') viewport.scrollLeft = element.offsetLeft;
				else viewport.scrollTop = element.offsetTop;
			}
		}
	};

	const updateVisiblePages = (): void => {
		if (!viewport || props.options.pageMode === 'single') {
			const current: PdfPageDescriptor | undefined = currentPage();
			const visible = new Set(current ? [current.id] : []);
			setVisiblePageIds((existing: Set<string>): Set<string> => equalPageSets(existing, visible) ? existing : visible);

			return;
		}

		const viewportRect: DOMRect = viewport.getBoundingClientRect();
		const preloadDistance: number =
			(props.options.scrollDirection === 'horizontal' ? viewportRect.width : viewportRect.height) *
			Math.max(0, props.options.preloadScreens);
		const visible = new Set<string>();
		let closestIndex = currentIndex();
		let closestDistance = Number.POSITIVE_INFINITY;
		const center: number =
			props.options.scrollDirection === 'horizontal'
				? viewportRect.left + viewportRect.width / 2
				: viewportRect.top + viewportRect.height / 2;

		for (const [index, descriptor] of pages().entries()) {
			const element: HTMLDivElement | undefined = pageElements.get(descriptor.id);

			if (!element) continue;
			const rect: DOMRect = element.getBoundingClientRect();
			const start: number = props.options.scrollDirection === 'horizontal' ? rect.left : rect.top;
			const end: number = props.options.scrollDirection === 'horizontal' ? rect.right : rect.bottom;
			const viewStart: number = props.options.scrollDirection === 'horizontal' ? viewportRect.left : viewportRect.top;
			const viewEnd: number = props.options.scrollDirection === 'horizontal' ? viewportRect.right : viewportRect.bottom;

			if (end >= viewStart - preloadDistance && start <= viewEnd + preloadDistance) visible.add(descriptor.id);

			const pageCenter: number = (start + end) / 2;
			const distance: number = Math.abs(pageCenter - center);

			if (distance < closestDistance) {
				closestDistance = distance;
				closestIndex = index;
			}
		}

		setVisiblePageIds((existing: Set<string>): Set<string> => equalPageSets(existing, visible) ? existing : visible);

		if (closestIndex !== currentIndex()) setCurrentIndex(closestIndex);
	};

	const handleScroll = (): void => {
		if (scrollFrame !== undefined) return;
		scrollFrame = requestAnimationFrame((): void => {
			scrollFrame = undefined;
			updateVisiblePages();
		});
	};

	const goToSearchIndex = (requestedIndex: number): void => {
		const matches: PdfSearchMatch[] = searchMatches();

		if (matches.length === 0) return;
		const nextIndex: number = (requestedIndex + matches.length) % matches.length;
		setSearchIndex(nextIndex);
		const match: PdfSearchMatch = matches[nextIndex];
		const pageIndex: number = pages().findIndex(
			(page: PdfPageDescriptor): boolean => page.globalIndex === match.globalPageIndex
		);

		if (pageIndex >= 0) scrollToIndex(pageIndex);
	};

	const jumpToDestination = async (destination: unknown): Promise<void> => {
		const page: PdfPageDescriptor | undefined = currentPage();

		if (!page) return;
		const globalIndex: number | undefined = await store.resolveOutline({
			destination,
			documentIndex: page.documentIndex,
			id: 'annotation-destination',
			level: 0,
			title: 'Annotation destination'
		});

		if (globalIndex === undefined) return;
		const filteredIndex: number = pages().findIndex(
			(candidate: PdfPageDescriptor): boolean => candidate.globalIndex === globalIndex
		);

		if (filteredIndex >= 0) scrollToIndex(filteredIndex);
	};

	const controller: PdfViewerController = {
		downloadCurrentDocument: async (): Promise<void> => {
			const page: PdfPageDescriptor | undefined = currentPage();

			if (!page) return;
			downloadPdfBytes(await page.pdfDocument.getData(), page.source.name);
		},
		firstPage: (): void => scrollToIndex(0),
		goToDocument: (documentIndex: number): void => {
			const index: number = pages().findIndex((page: PdfPageDescriptor): boolean => page.documentIndex === documentIndex);

			if (index >= 0) scrollToIndex(index);
		},
		goToDocumentPage: (documentIndex: number, pageNumber: number): void => {
			const index: number = pages().findIndex((page: PdfPageDescriptor): boolean => {
				return page.documentIndex === documentIndex && page.pageNumber === pageNumber;
			});

			if (index >= 0) scrollToIndex(index);
		},
		goToPage: (pageNumber: number): void => scrollToIndex(pageNumber - 1),
		jumpToOutline: async (item: PdfOutlineItem): Promise<void> => {
			const globalIndex: number | undefined = await store.resolveOutline(item);

			if (globalIndex === undefined) return;
			const filteredIndex: number = pages().findIndex(
				(page: PdfPageDescriptor): boolean => page.globalIndex === globalIndex
			);

			if (filteredIndex >= 0) scrollToIndex(filteredIndex);
		},
		lastPage: (): void => scrollToIndex(pages().length - 1),
		nextPage: (): void => scrollToIndex(currentIndex() + 1),
		nextSearchMatch: (): void => goToSearchIndex(searchIndex() + 1),
		previousPage: (): void => scrollToIndex(currentIndex() - 1),
		previousSearchMatch: (): void => goToSearchIndex(searchIndex() - 1),
		resetForms: (): void => {
			formValues.clear();

			for (const input of Array.from(viewport.querySelectorAll<HTMLInputElement>('input'))) {
				if (input.type === 'checkbox' || input.type === 'radio') input.checked = input.defaultChecked;
				else input.value = input.defaultValue;
			}

			for (const select of Array.from(viewport.querySelectorAll<HTMLSelectElement>('select'))) {
				for (const option of Array.from(select.options)) option.selected = option.defaultSelected;
			}

			for (const textarea of Array.from(viewport.querySelectorAll<HTMLTextAreaElement>('textarea'))) {
				textarea.value = textarea.defaultValue;
			}
		},
		resetZoom: (): void => {
			setZoom(1);
		},
		search: async (query: string): Promise<PdfSearchMatch[]> => {
			setSearchQuery(query.trim());
			setSearching(true);

			try {
				const matches: PdfSearchMatch[] = await store.search(query);
				setSearchMatches(matches);
				setSearchIndex(matches.length > 0 ? 0 : -1);

				if (matches.length > 0) goToSearchIndex(0);

				return matches;
			} finally {
				setSearching(false);
			}
		},
		submitForms: (): Record<string, string | string[]> => {
			const values: Record<string, string | string[]> = {};

			for (const [key, value] of formValues) {
				values[key] = value;
			}

			Object.assign(values, collectFormValues(viewport));
			const page: PdfPageDescriptor | undefined = currentPage();

			if (page) {
				props.onInteraction?.({
					documentIndex: page.documentIndex,
					documentName: page.documentName,
					pageNumber: page.pageNumber,
					type: 'form-submit',
					value: values
				});
			}

			return values;
		},
		zoomIn: (): void => {
			setZoom((current: number): number =>
				clamp(current + props.options.zoomStep, props.options.zoomMinimum, props.options.zoomMaximum)
			);
		},
		zoomOut: (): void => {
			setZoom((current: number): number =>
				clamp(current - props.options.zoomStep, props.options.zoomMinimum, props.options.zoomMaximum)
			);
		}
	};

	const stopAutoScroll = (): void => {
		if (autoScrollFrame !== undefined) cancelAnimationFrame(autoScrollFrame);
		autoScrollFrame = undefined;
	};

	const autoScroll = (timestamp: number): void => {
		if (!props.options.autoScrollEnabled || props.options.pageMode !== 'continuous' || hoverPaused || zoom() !== 1) {
			stopAutoScroll();

			return;
		}

		const horizontal: boolean = props.options.scrollDirection === 'horizontal';
		const position: number = horizontal ? viewport.scrollLeft : viewport.scrollTop;
		const maximum: number = horizontal
			? viewport.scrollWidth - viewport.clientWidth
			: viewport.scrollHeight - viewport.clientHeight;
		const deltaSeconds: number = Math.min(0.1, Math.max(0, (timestamp - autoScrollLastTime) / 1000));
		autoScrollLastTime = timestamp;

		if (maximum <= 0) {
			autoScrollFrame = requestAnimationFrame(autoScroll);

			return;
		}

		if (autoScrollPhase === 'scroll') {
			const next: number = Math.min(maximum, position + props.options.autoScrollSpeed * deltaSeconds);

			if (horizontal) viewport.scrollLeft = next;
			else viewport.scrollTop = next;

			if (next >= maximum) {
				autoScrollPhase = 'end-pause';
				autoScrollPauseStarted = timestamp;
			}
		} else if (autoScrollPhase === 'end-pause') {
			if (timestamp - autoScrollPauseStarted >= props.options.autoScrollEndPauseSeconds * 1000) {
				autoScrollPhase = 'rewind';
				autoScrollRewindStarted = timestamp;
				autoScrollRewindOrigin = position;
			}
		} else {
			const duration: number = props.options.autoScrollRewindSeconds * 1000;
			const progress: number = duration <= 0 ? 1 : clamp((timestamp - autoScrollRewindStarted) / duration, 0, 1);
			const next: number = autoScrollRewindOrigin * (1 - progress);

			if (horizontal) viewport.scrollLeft = next;
			else viewport.scrollTop = next;

			if (progress >= 1) autoScrollPhase = 'scroll';
		}

		autoScrollFrame = requestAnimationFrame(autoScroll);
	};

	const restartAutoScroll = (): void => {
		stopAutoScroll();

		if (!props.options.autoScrollEnabled || props.options.pageMode !== 'continuous' || zoom() !== 1) return;
		autoScrollPhase = 'scroll';
		autoScrollLastTime = performance.now();
		autoScrollFrame = requestAnimationFrame(autoScroll);
	};

	createEffect(
		on(
			(): string => sourceSignature(props.sources),
			async (): Promise<void> => {
				renderGeneration += 1;
				const generation: number = renderGeneration;
				setLoading(true);
				setError('');
				setSearchMatches([]);
				setSearchIndex(-1);
				setSearchQuery('');
				setZoom(1);
				formValues.clear();

				if (props.sources.length === 0) {
					await store.destroy();

					if (generation === renderGeneration) {
						setCollection(undefined);
						setLoading(false);
					}

					return;
				}

				try {
					const loaded: LoadedPdfCollection = await store.load(props.sources);

					if (generation !== renderGeneration) return;
					setCollection(loaded);
					setCurrentIndex(clamp(props.options.initialPage - 1, 0, Math.max(0, loaded.pages.length - 1)));
					queueMicrotask(updateVisiblePages);
				} catch (reason) {
					if (generation === renderGeneration) {
						setCollection(undefined);
						setError(reason instanceof Error ? reason.message : 'The PDF documents could not be loaded.');
					}
				} finally {
					if (generation === renderGeneration) setLoading(false);
				}
			}
		)
	);

	createEffect((): void => {
		void layouts();
		void props.options.pageMode;
		void props.options.scrollDirection;
		queueMicrotask(updateVisiblePages);
	});

	createEffect((): void => {
		props.onStateChange?.(state());
	});

	createEffect(on(currentIndex, (): void => emitPageChange(), { defer: true }));

	createEffect((): void => {
		void props.options.autoScrollEnabled;
		void props.options.autoScrollSpeed;
		void props.options.pageMode;
		void props.options.scrollDirection;
		void zoom();
		restartAutoScroll();
	});

	onMount((): void => {
		props.onController?.(controller);
		const observer = new ResizeObserver((): void => {
			setContainerSize({ height: Math.max(1, viewport.clientHeight), width: Math.max(1, viewport.clientWidth) });
		});
		observer.observe(viewport);
		setContainerSize({ height: Math.max(1, viewport.clientHeight), width: Math.max(1, viewport.clientWidth) });
		onCleanup((): void => observer.disconnect());
	});

	onCleanup((): void => {
		renderGeneration += 1;
		stopAutoScroll();

		if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
		void store.destroy();
	});

	return (
		<div
			ref={viewport}
			class={`${style['pdf-viewport']} ${props.class ?? ''}`}
			classList={{
				[style['hide-scrollbars']]: props.options.hideScrollbars,
				[style['horizontal']]: props.options.scrollDirection === 'horizontal',
				[style['single-page']]: props.options.pageMode === 'single'
			}}
			data-current-page={state().currentPage}
			data-document-count={state().documentCount}
			data-page-count={state().pageCount}
			data-pdf-ready={!loading() && !error() && pages().length > 0}
			data-preview-allow-overflow={props.options.pageMode === 'continuous' ? '' : undefined}
			onMouseEnter={(): void => {
				if (props.options.autoScrollPauseOnHover) {
					hoverPaused = true;
					stopAutoScroll();
				}
			}}
			onMouseLeave={(): void => {
				if (hoverPaused) {
					hoverPaused = false;
					restartAutoScroll();
				}
			}}
			onScroll={handleScroll}
		>
			<Show when={loading()}>
				<div class={style['pdf-status']} role="status">
					Preparing documents...
				</div>
			</Show>
			<Show when={!loading() && error()}>
				<div class={style['pdf-status']} role="alert">
					<strong>Document unavailable</strong>
					<span>{error()}</span>
				</div>
			</Show>
			<Show when={!loading() && !error() && pages().length === 0}>
				<div class={style['pdf-status']} role="status">
					<strong>No PDF selected</strong>
					<span>Choose a PDF file or folder in the widget properties.</span>
				</div>
			</Show>
			<div class={style['pdf-track']} style={{ '--pdf-separator-color': props.options.separatorColor }}>
				<For each={renderedPages()}>
					{(descriptor: PdfPageDescriptor, renderedIndex: Accessor<number>): JSX.Element => {
						const layout: Accessor<PdfPageLayout> = createMemo(() => pageLayout(descriptor));
						const isLast: Accessor<boolean> = createMemo(() => renderedIndex() === renderedPages().length - 1);

						return (
							<div
								ref={(element: HTMLDivElement): void => {
									pageElements.set(descriptor.id, element);
								}}
								class={style['pdf-page-wrapper']}
								classList={{ [style['with-separator']]: !isLast() && props.options.pageMode === 'continuous' }}
								data-global-page={descriptor.globalIndex + 1}
								style={{
									'--pdf-page-padding': `${props.options.pagePadding}px`,
									'--pdf-separator-size': `${props.options.separatorSize}px`,
									height: `${layout().height}px`,
									width: `${layout().width}px`
								}}
							>
								<PdfPage
									active={isPageActive(descriptor)}
									descriptor={descriptor}
									formValues={formValues}
									layout={layout()}
									navigateTo={(destination: unknown): void => {
										void jumpToDestination(destination);
									}}
									onInteraction={(event: PdfInteractionEvent): void => props.onInteraction?.(event)}
									options={props.options}
									searchQuery={
										searchMatches().some(
											(match: PdfSearchMatch): boolean => match.globalPageIndex === descriptor.globalIndex
										)
											? searchQuery()
											: ''
									}
								/>
							</div>
						);
					}}
				</For>
			</div>
		</div>
	);
};
