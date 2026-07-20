import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import type { ApiService, IExternalCommandService } from 'wallboard-app-sdk';
import { useApiMethods } from 'wallboard-app-sdk';

import { getMetadata } from '@hooks/system/getMetadata';
import { useExternalCommandListener } from '@hooks/system/useExternalCommandListener';
import { useSettings } from '@hooks/system/useSettings';

import type { Settings } from '@interfaces/application.interface';

import { resolveTheme } from '@utils/theme';

import style from '@components/wb-app/wb-app.module.scss';
import { keyboardLayoutsFor, OnScreenKeyboard } from '../../capabilities/keyboard';
import type { KeyboardLayoutId } from '../../capabilities/keyboard';
import { PdfViewer, PDF_JS_VERSION, resolvePdfSources } from '../../capabilities/pdf';
import type {
	PdfInteractionEvent,
	PdfOutlineItem,
	PdfSearchMatch,
	PdfSource,
	PdfViewerController,
	PdfViewerOptions,
	PdfViewerState
} from '../../capabilities/pdf';

type SidebarView = 'documents' | 'outline' | 'search';
type ThemeTokens = Record<'accent' | 'background' | 'border' | 'muted' | 'panel' | 'primary' | 'toolbar', string>;

const emptyState = (): PdfViewerState => ({
	currentDocumentIndex: 0,
	currentDocumentName: '',
	currentDocumentPage: 0,
	currentPage: 0,
	documentCount: 0,
	documents: [],
	error: '',
	loading: true,
	outlines: [],
	pageCount: 0,
	pagesInCurrentDocument: 0,
	searchIndex: -1,
	searchMatches: [],
	searchQuery: '',
	searching: false,
	zoom: 1
});

const previewSources = (): PdfSource[] =>
	import.meta.env.MODE !== 'production'
		? [
				{
					id: 'northline-handbook',
					name: 'northline-operations-handbook.pdf',
					url: '/preview/pdf-assets/northline-operations-handbook.pdf'
				},
				{
					id: 'northline-shift-brief',
					name: 'northline-shift-brief.pdf',
					url: '/preview/pdf-assets/northline-shift-brief.pdf'
				}
			]
		: [];

const fileLabel = (name: string): string => name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const settings: Accessor<Settings> = useSettings();
	const api: ApiService = useApiMethods(getMetadata());
	const [controller, setController] = createSignal<PdfViewerController>();
	const [sidebarView, setSidebarView] = createSignal<SidebarView>(settings().sidebarDefault);
	const [sidebarOpen, setSidebarOpen] = createSignal(settings().showSidebar);
	const [sources, setSources] = createSignal<PdfSource[]>([]);
	const [sourceError, setSourceError] = createSignal('');
	const [viewerState, setViewerState] = createSignal<PdfViewerState>(emptyState());
	const [searchInput, setSearchInput] = createSignal('');
	const [keyboardOpen, setKeyboardOpen] = createSignal(false);
	const [formNotice, setFormNotice] = createSignal('');
	let sourceGeneration = 0;
	let lastPageEvent = '';
	const keyboardLayouts = createMemo(() => {
		const configuredLanguage = settings().keyboardLanguages;
		const languages: KeyboardLayoutId[] = configuredLanguage === 'hu-en'
			? ['hu', 'en']
			: [configuredLanguage];

		return keyboardLayoutsFor(languages);
	});

	const viewerOptions: Accessor<PdfViewerOptions> = createMemo((): PdfViewerOptions => ({
		autoScrollEnabled: settings().autoScrollEnabled,
		autoScrollEndPauseSeconds: settings().autoScrollEndPauseSeconds,
		autoScrollPauseOnHover: settings().autoScrollPauseOnHover,
		autoScrollRewindSeconds: settings().autoScrollRewindSeconds,
		autoScrollSpeed: settings().autoScrollSpeed,
		fit: settings().fit,
		hideScrollbars: settings().hideScrollbars,
		initialPage: settings().initialPage,
		interactiveAnnotations: settings().interactiveAnnotations,
		pageEnd: settings().pageEnd,
		pageMode: settings().pageMode,
		pagePadding: settings().pagePadding,
		pageStart: settings().pageStart,
		preloadScreens: settings().preloadScreens,
		renderForms: settings().renderForms,
		renderTextLayer: settings().renderTextLayer,
		scrollDirection: settings().scrollDirection,
		separatorColor: settings().separatorColor,
		separatorSize: settings().separatorSize,
		zoomMaximum: settings().zoomMaximum,
		zoomMinimum: settings().zoomMinimum,
		zoomStep: settings().zoomStep
	}));

	const theme: Accessor<ThemeTokens> = createMemo((): ThemeTokens => {
		const custom: ThemeTokens = {
			accent: settings().accentColor,
			background: settings().backgroundColor,
			border: settings().borderColor,
			muted: settings().mutedTextColor,
			panel: settings().panelColor,
			primary: settings().primaryTextColor,
			toolbar: settings().toolbarColor
		};

		return resolveTheme(settings().themePreset, {
			custom,
			dark: {
				accent: '#42d6b5',
				background: '#101514',
				border: '#34413e',
				muted: '#9caaa6',
				panel: '#18201e',
				primary: '#f5f2e9',
				toolbar: '#121918'
			},
			light: {
				accent: '#087f70',
				background: '#e7ebe8',
				border: '#b8c3bf',
				muted: '#5f706b',
				panel: '#f8faf8',
				primary: '#15211f',
				toolbar: '#ffffff'
			}
		});
	});
	const themeStyle: Accessor<JSX.CSSProperties> = createMemo((): JSX.CSSProperties => {
		const tokens = theme();

		return {
			'--wb-pdf-workspace-accent': tokens.accent,
			'--wb-pdf-workspace-background': tokens.background,
			'--wb-pdf-workspace-border': tokens.border,
			'--wb-pdf-workspace-muted': tokens.muted,
			'--wb-pdf-workspace-panel': tokens.panel,
			'--wb-pdf-workspace-primary': tokens.primary,
			'--wb-pdf-workspace-toolbar': tokens.toolbar
		};
	});

	createEffect((): void => {
		const sourceMode = settings().sourceMode;
		const directFile = settings().pdfFile;
		const folder = settings().pdfFolder;
		const password = settings().password;
		const recursive = settings().recursiveFolder;
		const generation: number = sourceGeneration + 1;
		sourceGeneration = generation;
		setSourceError('');

		void resolvePdfSources({
			api,
			directFile,
			fallbackSources: previewSources(),
			folder,
			password,
			recursive,
			sourceMode
		})
			.then((resolved: PdfSource[]): void => {
				if (generation === sourceGeneration) setSources(resolved);
			})
			.catch((reason: unknown): void => {
				if (generation !== sourceGeneration) return;
				setSources([]);
				setSourceError(reason instanceof Error ? reason.message : 'The configured PDF source could not be read.');
			});
	});

	createEffect((): void => {
		setSidebarOpen(settings().showSidebar);
		setSidebarView(settings().sidebarDefault);

		if (!settings().onScreenKeyboard) setKeyboardOpen(false);
	});

	const runSearch = async (): Promise<void> => {
		const query: string = searchInput().trim();

		if (!query || !controller()) return;
		setSidebarView('search');
		await controller()!.search(query);
	};

	const submitForms = (): void => {
		const values = controller()?.submitForms() ?? {};
		const count: number = Object.keys(values).length;
		setFormNotice(count === 1 ? '1 form field submitted' : `${count} form fields submitted`);
		setTimeout((): void => {
			setFormNotice('');
		}, 3500);
	};

	const handleInteraction = (event: PdfInteractionEvent): void => {
		if (event.type === 'page-change') {
			const key = `${event.documentIndex}:${event.pageNumber}`;

			if (key === lastPageEvent) return;
			lastPageEvent = key;
			api.triggerSensorEvent('pdf-page-viewed', {
				document: event.documentName,
				page: event.pageNumber
			});

			return;
		}

		api.triggerSensorEvent('pdf-document-interaction', {
			document: event.documentName,
			page: event.pageNumber,
			type: event.type,
			value: event.value
		});
	};

	useExternalCommandListener((command: IExternalCommandService): void => {
		const activeController: PdfViewerController | undefined = controller();

		if (!activeController) return;

		switch (command.getCommand()) {
			case 'firstPage':
				activeController.firstPage();
				break;

			case 'previousPage':
				activeController.previousPage();
				break;

			case 'nextPage':
				activeController.nextPage();
				break;

			case 'lastPage':
				activeController.lastPage();
				break;

			case 'zoomIn':
				activeController.zoomIn();
				break;

			case 'zoomOut':
				activeController.zoomOut();
				break;

			case 'resetZoom':
				activeController.resetZoom();
				break;

			case 'nextSearchMatch':
				activeController.nextSearchMatch();
				break;

			case 'previousSearchMatch':
				activeController.previousSearchMatch();
				break;

			case 'downloadPdf':
				void activeController.downloadCurrentDocument();
				break;

			case 'submitPdfForms':
				submitForms();
				break;

			case 'resetPdfForms':
				activeController.resetForms();
				break;

			case 'setPage': {
				const page: number = Number(command.getParameter('page'));

				if (Number.isFinite(page) && page >= 1) activeController.goToPage(page);
				break;
			}

			case 'setDocument': {
				const documentNumber: number = Number(command.getParameter('document'));

				if (Number.isFinite(documentNumber) && documentNumber >= 1) activeController.goToDocument(documentNumber - 1);
				break;
			}

			case 'searchPdf': {
				const query: string = String(command.getParameter('query') ?? '').trim();

				if (query) {
					setSearchInput(query);
					void runSearch();
				}
				break;
			}
		}
	});

	return (
		<div
			class={style['wb-app']}
			data-auto-scroll-speed={settings().autoScrollSpeed}
			data-current-document={viewerState().currentDocumentIndex + 1}
			data-current-document-page={viewerState().currentDocumentPage}
			data-current-page={viewerState().currentPage}
			data-host-ready={Boolean(props.hostElement)}
			data-page-padding={settings().pagePadding}
			data-preview-id="pdf-document-workspace-root"
			data-separator-size={settings().separatorSize}
			data-search-index={viewerState().searchIndex}
			data-source-count={sources().length}
			data-theme={settings().themePreset}
			style={themeStyle()}
		>
			<header class={style['topbar']}>
				<div class={style['brand-lockup']}>
					<div class={style['brand-mark']} aria-hidden="true">
						NW
					</div>
					<div class={style['brand-copy']}>
						<span class={style['eyebrow']} data-text-role="eyebrow">Northline records</span>
						<strong data-text-role="workspace-title">{settings().title}</strong>
					</div>
				</div>

				<div class={style['document-status']}>
					<span data-text-role="document-status">
						{viewerState().currentDocumentName ? fileLabel(viewerState().currentDocumentName) : 'No document selected'}
					</span>
					<small data-text-role="document-meta">
						{viewerState().documentCount} {viewerState().documentCount === 1 ? 'document' : 'documents'}
						{' / '}
						{viewerState().pageCount} pages
					</small>
				</div>

				<Show when={settings().showSidebar}>
					<button
						class={style['header-button']}
						type="button"
						aria-label={sidebarOpen() ? 'Hide document sidebar' : 'Show document sidebar'}
						onClick={(): void => {
							setSidebarOpen((value: boolean): boolean => !value);
						}}
					>
						{sidebarOpen() ? 'Hide panel' : 'Show panel'}
					</button>
				</Show>
			</header>

			<main class={style['workspace']}>
				<Show when={sidebarOpen()}>
					<aside class={style['sidebar']}>
						<div class={style['sidebar-tabs']} role="tablist" aria-label="Document tools">
							<For
								each={[
									{ id: 'documents' as const, label: 'Files' },
									{ id: 'outline' as const, label: 'Outline' },
									{ id: 'search' as const, label: 'Search' }
								]}
							>
								{(tab): JSX.Element => (
									<button
										class={sidebarView() === tab.id ? style['active'] : undefined}
										type="button"
										role="tab"
										aria-selected={sidebarView() === tab.id}
										onClick={(): void => {
											setSidebarView(tab.id);
										}}
									>
										{tab.label}
									</button>
								)}
							</For>
						</div>

						<div class={style['sidebar-content']} data-preview-allow-overflow>
							<Show when={sidebarView() === 'documents'}>
								<section aria-label="Documents">
									<div class={style['section-heading']} data-text-role="section-heading">
										<span>Document set</span>
										<strong>{viewerState().documents.length}</strong>
									</div>
									<div class={style['document-list']}>
										<For each={viewerState().documents}>
											{(source: PdfSource, index: Accessor<number>): JSX.Element => (
												<button
													class={`${style['document-row']} ${viewerState().currentDocumentIndex === index() ? style['selected'] : ''}`}
													type="button"
													onClick={(): void => controller()?.goToDocument(index())}
												>
													<span class={style['file-number']}>{String(index() + 1).padStart(2, '0')}</span>
													<span>
														<strong data-text-role="document-row">{fileLabel(source.name)}</strong>
														<small>PDF document</small>
													</span>
												</button>
											)}
										</For>
									</div>
									<Show when={settings().renderForms}>
										<div class={style['form-actions']}>
											<span>Interactive forms</span>
											<div>
												<button
													type="button"
													onClick={(): void => {
														controller()?.resetForms();
													}}
												>
													Reset
												</button>
												<button type="button" onClick={submitForms}>
													Submit
												</button>
											</div>
											<Show when={formNotice()}>
												<small data-form-notice>{formNotice()}</small>
											</Show>
										</div>
									</Show>
								</section>
							</Show>

							<Show when={sidebarView() === 'outline'}>
								<section aria-label="Document outline">
									<div class={style['section-heading']} data-text-role="section-heading">
										<span>Bookmarks</span>
										<strong>{viewerState().outlines.length}</strong>
									</div>
									<Show
										when={viewerState().outlines.length > 0}
										fallback={<p class={style['empty-copy']}>This document set has no bookmarks.</p>}
									>
										<For each={viewerState().outlines}>
											{(item: PdfOutlineItem): JSX.Element => (
												<button
													class={style['outline-row']}
													type="button"
													style={{ '--wb-pdf-workspace-outline-indent': `${item.level * 16}px` }}
													onClick={(): void => {
														void controller()?.jumpToOutline(item);
													}}
												>
													<span>{String(item.documentIndex + 1).padStart(2, '0')}</span>
															<strong data-text-role="outline-row">{item.title}</strong>
												</button>
											)}
										</For>
									</Show>
								</section>
							</Show>

							<Show when={sidebarView() === 'search'}>
								<section aria-label="Search documents">
									<form
										class={style['search-form']}
										onSubmit={(event: SubmitEvent): void => {
											event.preventDefault();
											void runSearch();
										}}
									>
										<label for="pdf-search-input">Search all documents</label>
										<div>
											<input
												id="pdf-search-input"
												type="search"
												value={searchInput()}
												onInput={(event): void => {
													setSearchInput(event.currentTarget.value);
												}}
												onFocus={(): void => {
													if (settings().onScreenKeyboard) setKeyboardOpen(true);
												}}
											/>
											<button type="submit">Find</button>
										</div>
									</form>
									<div class={style['search-summary']}>
										<span>
											{viewerState().searching ? 'Searching...' : `${viewerState().searchMatches.length} matches`}
										</span>
										<Show when={viewerState().searchMatches.length > 0}>
											<div>
												<button
													type="button"
													aria-label="Previous search result"
													onClick={(): void => controller()?.previousSearchMatch()}
												>
													&lt;
												</button>
												<span>
													{viewerState().searchIndex + 1} / {viewerState().searchMatches.length}
												</span>
												<button
													type="button"
													aria-label="Next search result"
													onClick={(): void => controller()?.nextSearchMatch()}
												>
													&gt;
												</button>
											</div>
										</Show>
									</div>
									<div class={style['search-results']}>
										<For each={viewerState().searchMatches}>
											{(match: PdfSearchMatch, index: Accessor<number>): JSX.Element => (
												<button type="button" onClick={(): void => controller()?.goToPage(match.globalPageIndex + 1)}>
													<span>Page {match.globalPageIndex + 1}</span>
															<strong data-text-role="search-result">{match.preview || `Match ${index() + 1}`}</strong>
												</button>
											)}
										</For>
									</div>
								</section>
							</Show>
						</div>

						<div class={style['sidebar-footer']}>
							<span>PDF.js {PDF_JS_VERSION}</span>
							<button
								type="button"
								onClick={(): void => {
									void controller()?.downloadCurrentDocument();
								}}
							>
								Download
							</button>
						</div>
					</aside>
				</Show>

				<section class={style['viewer-shell']} aria-label="PDF viewer">
					<Show when={sourceError()}>
						<div class={style['source-error']} role="alert">
							<strong>Source unavailable</strong>
							<span>{sourceError()}</span>
						</div>
					</Show>
					<PdfViewer
						class={`${style['viewer']} ${settings().showControls ? style['viewer-with-controls'] : ''}`}
						onController={(value: PdfViewerController): void => {
							setController(() => value);
						}}
						onInteraction={handleInteraction}
						onStateChange={(value: PdfViewerState): void => {
							setViewerState(value);
						}}
						options={viewerOptions()}
						sources={sources()}
					/>

					<Show when={settings().showControls}>
						<nav class={style['controls']} aria-label="PDF navigation">
							<div class={style['control-group']}>
								<button type="button" aria-label="First page" onClick={(): void => controller()?.firstPage()}>
									&lt;&lt;
								</button>
								<button type="button" aria-label="Previous page" onClick={(): void => controller()?.previousPage()}>
									&lt;
								</button>
							</div>
							<div class={style['page-readout']} data-text-role="page-readout">
								<strong>{viewerState().currentDocumentPage || 0}</strong>
								<span>/ {viewerState().pagesInCurrentDocument || 0}</span>
								<small data-text-role="page-document">
									{viewerState().currentDocumentName ? fileLabel(viewerState().currentDocumentName) : 'Document'}
								</small>
							</div>
							<div class={style['control-group']}>
								<button type="button" aria-label="Next page" onClick={(): void => controller()?.nextPage()}>
									&gt;
								</button>
								<button type="button" aria-label="Last page" onClick={(): void => controller()?.lastPage()}>
									&gt;&gt;
								</button>
							</div>
							<div class={style['control-divider']} />
							<div class={style['control-group']}>
								<button type="button" aria-label="Zoom out" onClick={(): void => controller()?.zoomOut()}>
									-
								</button>
								<button
									type="button"
									class={style['zoom-readout']}
									aria-label="Reset zoom"
									onClick={(): void => controller()?.resetZoom()}
								>
									{Math.round(viewerState().zoom * 100)}%
								</button>
								<button type="button" aria-label="Zoom in" onClick={(): void => controller()?.zoomIn()}>
									+
								</button>
							</div>
						</nav>
					</Show>
				</section>
			</main>
			<Show when={keyboardOpen() && sidebarOpen() && sidebarView() === 'search'}>
				<OnScreenKeyboard
					accentColor={theme().accent}
					backgroundColor={theme().toolbar}
					borderColor={theme().border}
					label="Search documents"
					layouts={keyboardLayouts()}
					maximumLength={120}
					onClose={(): void => { setKeyboardOpen(false); }}
					onInput={setSearchInput}
					onSubmit={(): void => {
						setKeyboardOpen(false);
						void runSearch();
					}}
					submitLabel="Find"
					textColor={theme().primary}
					value={searchInput()}
				/>
			</Show>
		</div>
	);
};
