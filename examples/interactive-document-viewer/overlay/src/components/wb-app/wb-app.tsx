import { batch, createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import type { ApiService, IExternalCommandService } from 'wallboard-app-sdk';
import { useApiMethods } from 'wallboard-app-sdk';

import { getMetadata } from '@hooks/system/getMetadata';
import { useDataSources } from '@hooks/system/useDataSources';
import { useExternalCommandListener } from '@hooks/system/useExternalCommandListener';
import { useSettings } from '@hooks/system/useSettings';

import type { DocumentMetadataValue, DocumentRecord } from '@interfaces/document.interface';
import type { DataSources, Settings } from '@interfaces/application.interface';

import { documentCategories, filterDocuments, filterDocumentsBySchedule, normalizeDocuments } from '@utils/documents';

import style from '@components/wb-app/wb-app.module.scss';
import Icon from '@components/wb-icon/wb-icon';
import sampleDatasourceJson from '../../../sample-datasource.json';
import { OnScreenKeyboard } from '../../capabilities/keyboard';
import { normalizePdfSelection, PdfViewer } from '../../capabilities/pdf';
import type { PdfSource, PdfViewerController, PdfViewerOptions, PdfViewerState } from '../../capabilities/pdf';

type SurfaceMode = 'compact' | 'landscape' | 'portrait' | 'square';

const emptyViewerState = (): PdfViewerState => ({
	currentDocumentIndex: 0,
	currentDocumentName: '',
	currentDocumentPage: 0,
	currentPage: 0,
	documentCount: 0,
	documents: [],
	error: '',
	loading: false,
	outlines: [],
	pageCount: 0,
	pagesInCurrentDocument: 0,
	searchIndex: -1,
	searchMatches: [],
	searchQuery: '',
	searching: false,
	zoom: 1
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const parsedValue = (value: unknown): unknown => {
	if (typeof value !== 'string') return value;

	try {
		return JSON.parse(value) as unknown;
	} catch {
		return value;
	}
};

const assetLocation = (value: unknown, depth = 0): string => {
	if (depth > 4) return '';
	const parsed = parsedValue(value);

	if (typeof parsed === 'string') {
		const location = parsed.trim();

		return /^(?:https?:\/\/|data:image\/|blob:|\/)/i.test(location) ? location : '';
	}

	if (Array.isArray(parsed)) {
		for (const candidate of parsed) {
			const location = assetLocation(candidate, depth + 1);

			if (location) return location;
		}

		return '';
	}

	if (!isRecord(parsed)) return '';

	for (const key of ['cacheCheckedSource', 'location', 'url', 'src', 'filePath', 'path']) {
		const location = assetLocation(parsed[key], depth + 1);

		if (location) return location;
	}

	for (const key of ['file', 'image', 'selection', 'value', 'data', 'content']) {
		const location = assetLocation(parsed[key], depth + 1);

		if (location) return location;
	}

	return '';
};

const resolveAsset = async (api: ApiService, value: unknown): Promise<string> => {
	const location = assetLocation(value);

	if (!location) return '';

	try {
		return (await api.cacheFile(location)) || location;
	} catch {
		return location;
	}
};

const surfaceMode = (width: number, height: number): SurfaceMode => {
	if (height > width * 1.12) return 'portrait';

	if (Math.abs(width - height) < Math.min(width, height) * 0.18) return 'square';

	if (width <= 820 || height <= 620) return 'compact';

	return 'landscape';
};

const dateFromValue = (value: unknown): Date | null => {
	const parsed = parsedValue(value);
	let candidate = '';

	if (typeof parsed === 'string') candidate = parsed;

	if (isRecord(parsed) && typeof parsed.date === 'string') candidate = parsed.date;

	if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;

	const parts = candidate.split('-').map(Number);
	const date = new Date(parts[0], parts[1] - 1, parts[2]);

	return Number.isNaN(date.getTime()) ? null : date;
};

const formatDocumentValue = (metadata: DocumentMetadataValue, format: Settings['dateFormat']): string => {
	const date = dateFromValue(metadata.rawValue);

	if (!date) return metadata.value;

	if (format === 'numeric')
		return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);

	if (format === 'medium')
		return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);

	return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
};

export default (props: { hostElement: HTMLDivElement }): JSX.Element => {
	const dataSources: Accessor<DataSources> = useDataSources();
	const settings: Accessor<Settings> = useSettings();
	const api: ApiService = useApiMethods(getMetadata());
	const [controller, setController] = createSignal<PdfViewerController>();
	const [viewerState, setViewerState] = createSignal<PdfViewerState>(emptyViewerState());
	const [pdfSources, setPdfSources] = createSignal<PdfSource[]>([]);
	const [selectedCategory, setSelectedCategory] = createSignal('');
	const [selectedDocumentId, setSelectedDocumentId] = createSignal('');
	const [searchQuery, setSearchQuery] = createSignal('');
	const [keyboardOpen, setKeyboardOpen] = createSignal(false);
	const [accessibleReach, setAccessibleReach] = createSignal(false);
	const [screensaverVisible, setScreensaverVisible] = createSignal(false);
	const [surface, setSurface] = createSignal<SurfaceMode>('landscape');
	const [now, setNow] = createSignal(new Date());
	const [logoUrl, setLogoUrl] = createSignal('');
	const [logoFailed, setLogoFailed] = createSignal(false);
	const [directoryIconUrl, setDirectoryIconUrl] = createSignal('');
	const [directoryIconFailed, setDirectoryIconFailed] = createSignal(false);
	const [backgroundImageUrl, setBackgroundImageUrl] = createSignal('');
	const [screensaverImageUrl, setScreensaverImageUrl] = createSignal('');
	const [screensaverLogoUrl, setScreensaverLogoUrl] = createSignal('');
	const [screensaverLogoFailed, setScreensaverLogoFailed] = createSignal(false);
	const [sourceError, setSourceError] = createSignal('');
	const [portraitReaderOpen, setPortraitReaderOpen] = createSignal(false);
	let rootElement!: HTMLElement;
	let idleTimer: number | undefined;
	let pdfGeneration = 0;
	let assetGeneration = 0;

	const hasBoundDatasource = createMemo((): boolean =>
		Object.prototype.hasOwnProperty.call(dataSources(), 'documentsData')
	);
	const rawDocuments = createMemo((): unknown => {
		if (hasBoundDatasource()) return dataSources().documentsData?.value;

		return import.meta.env.MODE !== 'production' ? sampleDatasourceJson : null;
	});
	const documents = createMemo((): DocumentRecord[] =>
		normalizeDocuments(rawDocuments(), {
			categoryField: settings().categoryColumn,
			metadataFields: settings().metadataColumns,
			pdfField: settings().pdfColumn,
			scheduleField: settings().scheduleColumn,
			titleField: settings().titleColumn
		})
	);
	const availableDocuments = createMemo((): DocumentRecord[] =>
		filterDocumentsBySchedule(documents(), now().getTime(), settings().scheduleRetentionDays)
	);
	const categories = createMemo((): string[] => documentCategories(availableDocuments()));
	const visibleDocuments = createMemo((): DocumentRecord[] =>
		filterDocuments(availableDocuments(), selectedCategory(), searchQuery())
	);
	const selectedDocument = createMemo(
		(): DocumentRecord | undefined =>
			visibleDocuments().find((document: DocumentRecord): boolean => document.id === selectedDocumentId()) ??
			availableDocuments().find((document: DocumentRecord): boolean => document.id === selectedDocumentId())
	);
	const activePdfSources = createMemo((): PdfSource[] => {
		const selectedId = selectedDocumentId();

		return selectedId ? pdfSources().filter((source: PdfSource): boolean => source.id === selectedId) : [];
	});
	const headerCopyVisible = createMemo((): boolean => settings().showEyebrow || settings().showAppTitle);
	const customLogoVisible = createMemo((): boolean => Boolean(logoUrl()) && !logoFailed());
	const customDirectoryIconVisible = createMemo((): boolean => Boolean(directoryIconUrl()) && !directoryIconFailed());
	const customScreensaverLogoVisible = createMemo(
		(): boolean => Boolean(screensaverLogoUrl()) && !screensaverLogoFailed()
	);
	const portraitReaderVisible = createMemo(
		(): boolean => surface() !== 'portrait' || !settings().portraitReaderAfterSelection || portraitReaderOpen()
	);
	const viewerOptions = createMemo((): PdfViewerOptions => ({
		autoScrollEnabled: false,
		autoScrollEndPauseSeconds: 0,
		autoScrollPauseOnHover: true,
		autoScrollRewindSeconds: 0,
		autoScrollSpeed: 1,
		fit: settings().fit,
		hideScrollbars: false,
		initialPage: 1,
		interactiveAnnotations: settings().interactiveAnnotations,
		pageEnd: 0,
		pageMode: settings().pageMode,
		pagePadding: 14,
		pageStart: 1,
		preloadScreens: 1,
		renderForms: settings().renderForms,
		renderTextLayer: settings().renderTextLayer,
		scrollDirection: 'vertical',
		separatorColor: '#d8e1ec',
		separatorSize: 1,
		zoomMaximum: settings().zoomMaximum,
		zoomMinimum: settings().zoomMinimum,
		zoomStep: settings().zoomStep
	}));
	const rootStyle = createMemo((): JSX.CSSProperties => {
		const image = backgroundImageUrl().replace(/["\\]/g, '');

		return {
			'--wb-interactive-document-viewer-background': settings().backgroundColor,
			'--wb-interactive-document-viewer-background-two': settings().backgroundColorTwo,
			'--wb-interactive-document-viewer-background-image': image ? `url("${image}")` : 'none',
			'--wb-interactive-document-viewer-button': settings().buttonColor,
			'--wb-interactive-document-viewer-button-text': settings().buttonTextColor,
			'--wb-interactive-document-viewer-keyboard': settings().keyboardColor,
			'--wb-interactive-document-viewer-keyboard-key': settings().keyboardKeyColor,
			'--wb-interactive-document-viewer-list': settings().listColor,
			'--wb-interactive-document-viewer-muted': settings().mutedTextColor,
			'--wb-interactive-document-viewer-panel': settings().panelColor,
			'--wb-interactive-document-viewer-primary': settings().primaryTextColor,
			'--wb-interactive-document-viewer-screensaver-overlay': settings().screensaverOverlayColor
		};
	});
	const formattedTime = createMemo((): string =>
		new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			hour12: settings().timeFormat === '12',
			minute: '2-digit'
		}).format(now())
	);
	const formattedDate = createMemo((): string => {
		if (settings().dateFormat === 'numeric') {
			return new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now());
		}

		return new Intl.DateTimeFormat('en-US', {
			day: 'numeric',
			month: settings().dateFormat === 'medium' ? 'short' : 'long',
			year: 'numeric'
		}).format(now());
	});

	const scheduleIdle = (enabled = settings().screensaverEnabled, seconds = settings().idleSeconds): void => {
		if (idleTimer !== undefined) window.clearTimeout(idleTimer);
		idleTimer = undefined;

		if (!enabled || screensaverVisible()) return;
		idleTimer = window.setTimeout((): void => {
			setKeyboardOpen(false);
			setAccessibleReach(false);
			setPortraitReaderOpen(false);
			setScreensaverVisible(true);
		}, seconds * 1000);
	};

	const resetSession = (): void => {
		setSearchQuery('');
		setSelectedCategory('');
		setPortraitReaderOpen(false);
		const first = availableDocuments().find((document: DocumentRecord): boolean => Boolean(document.pdf));
		setSelectedDocumentId(first?.id ?? '');
	};

	const registerActivity = (): void => {
		if (screensaverVisible()) {
			setScreensaverVisible(false);
			resetSession();
		}
		scheduleIdle();
	};

	createEffect((): void => {
		const available = visibleDocuments();
		const current = selectedDocumentId();
		const waitsForPortraitSelection =
			surface() === 'portrait' && settings().portraitReaderAfterSelection && !portraitReaderOpen();

		if (waitsForPortraitSelection) {
			if (current) setSelectedDocumentId('');

			return;
		}

		if (available.some((document: DocumentRecord): boolean => document.id === current && Boolean(document.pdf))) return;
		const first = available.find((document: DocumentRecord): boolean => Boolean(document.pdf));
		setSelectedDocumentId(first?.id ?? '');
	});

	createEffect((): void => {
		const available = categories();
		const current = selectedCategory();

		if (current && !available.includes(current)) setSelectedCategory('');
	});

	createEffect((): void => {
		if (!settings().showAccessibilityButton && accessibleReach()) setAccessibleReach(false);
	});

	createEffect((): void => {
		if (!settings().keyboardEnabled && keyboardOpen()) setKeyboardOpen(false);
	});

	createEffect((): void => {
		const document = selectedDocument();
		pdfGeneration += 1;
		const generation = pdfGeneration;
		setSourceError('');
		setViewerState(emptyViewerState());

		if (!document?.pdf) {
			setPdfSources([]);

			return;
		}

		const source = normalizePdfSelection(document.pdf, document.id);

		if (!source) {
			setPdfSources([]);
			setSourceError('This record does not contain a usable PDF file.');

			return;
		}

		void Promise.resolve(api.cacheFile(source.url))
			.then((cached: string): void => {
				if (generation !== pdfGeneration) return;
				setPdfSources([{ ...source, name: document.title, url: cached || source.url }]);
			})
			.catch((): void => {
				if (generation !== pdfGeneration) return;
				setPdfSources([{ ...source, name: document.title }]);
			});
	});

	createEffect((): void => {
		const logo = settings().logoFile;
		const directoryIcon = settings().directoryIconFile;
		const background = settings().backgroundImage;
		const screensaver = settings().screensaverImage;
		const screensaverLogo = settings().screensaverLogoFile;
		assetGeneration += 1;
		const generation = assetGeneration;
		setLogoFailed(false);
		setDirectoryIconFailed(false);
		setScreensaverLogoFailed(false);

		void Promise.all([
			resolveAsset(api, logo),
			resolveAsset(api, directoryIcon),
			resolveAsset(api, background),
			resolveAsset(api, screensaver),
			resolveAsset(api, screensaverLogo)
		]).then(
			([
				resolvedLogo,
				resolvedDirectoryIcon,
				resolvedBackground,
				resolvedScreensaver,
				resolvedScreensaverLogo
			]): void => {
				if (generation !== assetGeneration) return;
				setLogoUrl(resolvedLogo);
				setDirectoryIconUrl(resolvedDirectoryIcon);
				setBackgroundImageUrl(resolvedBackground);
				setScreensaverImageUrl(resolvedScreensaver);
				setScreensaverLogoUrl(resolvedScreensaverLogo);
			}
		);
	});

	createEffect((): void => {
		scheduleIdle(settings().screensaverEnabled, settings().idleSeconds);
	});

	onMount((): void => {
		const clockTimer = window.setInterval((): void => {
			setNow(new Date());
		}, 1000);
		const updateSurface = (width: number, height: number): void => {
			setSurface(surfaceMode(width, height));
		};
		const observer = new ResizeObserver((entries: ResizeObserverEntry[]): void => {
			const entry = entries[0];

			if (entry) updateSurface(entry.contentRect.width, entry.contentRect.height);
		});
		const bounds = rootElement.getBoundingClientRect();
		updateSurface(bounds.width, bounds.height);
		observer.observe(rootElement);
		scheduleIdle();

		onCleanup((): void => {
			window.clearInterval(clockTimer);

			if (idleTimer !== undefined) window.clearTimeout(idleTimer);
			observer.disconnect();
		});
	});

	useExternalCommandListener((command: IExternalCommandService): void => {
		const active = controller();

		if (!active && command.getCommand() !== 'resetKiosk') return;

		switch (command.getCommand()) {
			case 'firstPage':
				active?.firstPage();
				break;

			case 'previousPage':
				active?.previousPage();
				break;

			case 'nextPage':
				active?.nextPage();
				break;

			case 'lastPage':
				active?.lastPage();
				break;

			case 'zoomIn':
				active?.zoomIn();
				break;

			case 'zoomOut':
				active?.zoomOut();
				break;

			case 'resetZoom':
				active?.resetZoom();
				break;

			case 'resetKiosk':
				setScreensaverVisible(false);
				setAccessibleReach(false);
				resetSession();
				break;
		}
	});

	const renderKeyboard = (placement: 'directory' | 'page'): JSX.Element => (
		<OnScreenKeyboard
			accentColor={settings().buttonColor}
			backgroundColor={settings().keyboardColor}
			borderColor={settings().mutedTextColor}
			keyColor={settings().keyboardKeyColor}
			label="On-screen keyboard"
			embedded
			maximumLength={120}
			onClose={(): void => {
				setKeyboardOpen(false);
			}}
			onInput={setSearchQuery}
			onSubmit={(): void => {
				setKeyboardOpen(false);
			}}
			placement={placement}
			submitLabel="Search"
			submitTextColor={settings().buttonTextColor}
			textColor={settings().primaryTextColor}
			textScale={settings().keyboardTextScale}
			value={searchQuery()}
		/>
	);

	return (
		<section
			ref={rootElement}
			class={style['wb-app']}
			data-accessibility={accessibleReach()}
			data-active-pdf-id={viewerState().documents[viewerState().currentDocumentIndex]?.id ?? ''}
			data-background-mode={settings().backgroundMode}
			data-bound={hasBoundDatasource()}
			data-directory-icon={settings().showDirectoryIcon}
			data-document-count={availableDocuments().length}
			data-expired-document-retention-days={settings().scheduleRetentionDays}
			data-header-copy={headerCopyVisible()}
			data-host-ready={Boolean(props.hostElement)}
			data-idle-seconds={settings().idleSeconds}
			data-keyboard-open={keyboardOpen()}
			data-keyboard-placement={keyboardOpen() ? (surface() === 'portrait' ? 'page' : 'directory') : 'closed'}
			data-keyboard-text-scale={settings().keyboardTextScale}
			data-logo-source={customLogoVisible() ? 'custom' : 'default'}
			data-many-categories={categories().length > 8}
			data-pdf-ready={!viewerState().loading && Boolean(viewerState().pageCount)}
			data-portrait-reader-first={settings().portraitReaderFirst}
			data-portrait-reader-open={portraitReaderVisible()}
			data-preview-id="interactive-document-viewer-root"
			data-screensaver={screensaverVisible()}
			data-screensaver-logo={customScreensaverLogoVisible() ? 'custom' : 'none'}
			data-screensaver-overlay-color={settings().screensaverOverlayColor}
			data-schedule-column={settings().scheduleColumn}
			data-selected-document-id={selectedDocumentId()}
			data-surface={surface()}
			style={rootStyle()}
			tabIndex={-1}
			onKeyDown={registerActivity}
			onPointerDown={registerActivity}
			onWheel={registerActivity}
		>
			<header class={style.header}>
				<div class={style.brand}>
					<Show
						when={customLogoVisible()}
						fallback={
							<span class={style['brand-fallback']} role="img" aria-label={settings().appTitle}>
								<Icon name="landmark" />
							</span>
						}
					>
						<img
							src={logoUrl()}
							alt={settings().showAppTitle ? '' : settings().appTitle}
							onError={(): void => {
								setLogoFailed(true);
							}}
						/>
					</Show>
					<Show when={headerCopyVisible()}>
						<div class={style['brand-copy']}>
							<Show when={settings().showEyebrow}>
								<span class={style.eyebrow} data-text-role="header-eyebrow">
									{settings().eyebrowText}
								</span>
							</Show>
							<Show when={settings().showAppTitle}>
								<h1 data-text-role="app-title">{settings().appTitle}</h1>
							</Show>
						</div>
					</Show>
				</div>
				<Show when={settings().showClock}>
					<div class={style.clock} aria-label={`${formattedTime()}, ${formattedDate()}`}>
						<strong>{formattedTime()}</strong>
						<span data-text-role="clock-date">{formattedDate()}</span>
					</div>
				</Show>
			</header>

			<nav class={style.categories} aria-label="Document categories">
				<button
					class={selectedCategory() === '' ? style.active : undefined}
					type="button"
					aria-label={`All documents ${availableDocuments().length}`}
					aria-pressed={selectedCategory() === ''}
					onClick={(): void => {
						setSelectedCategory('');
						setSearchQuery('');
						setPortraitReaderOpen(false);
					}}
				>
					<span data-text-role="category-label">All documents</span>
					<small>{availableDocuments().length}</small>
				</button>
				<For each={categories()}>
					{(category: string): JSX.Element => (
						<button
							class={`${selectedCategory() === category ? style.active : ''} ${category.length > 34 ? style['long-category'] : ''}`}
							type="button"
							aria-label={`${category} ${availableDocuments().filter((item: DocumentRecord): boolean => item.category === category).length}`}
							aria-pressed={selectedCategory() === category}
							onClick={(): void => {
								setSelectedCategory(category);
								setSearchQuery('');
								setPortraitReaderOpen(false);
							}}
						>
							<span data-text-role="category-label">{category}</span>
							<small>
								{availableDocuments().filter((item: DocumentRecord): boolean => item.category === category).length}
							</small>
						</button>
					)}
				</For>
			</nav>

			<main class={style.workspace}>
				<aside class={style.directory} aria-label="Document directory">
					<div class={style['directory-header']}>
						<div>
							<span>Document directory</span>
							<strong>
								{visibleDocuments().length} {visibleDocuments().length === 1 ? 'result' : 'results'}
							</strong>
						</div>
						<Show when={settings().showAccessibilityButton}>
							<button
								class={style['accessibility-button']}
								type="button"
								aria-label="Toggle accessible reach mode"
								aria-pressed={accessibleReach()}
								onClick={(): void => {
									setAccessibleReach((value: boolean): boolean => !value);
								}}
							>
								<Icon name="universal-access" />
								<span>{accessibleReach() ? 'Standard layout' : 'Accessible reach'}</span>
							</button>
						</Show>
					</div>

					<div class={style.search}>
						<span aria-hidden="true">
							<Icon name="search" />
						</span>
						<input
							type="search"
							aria-label="Search the document directory"
							placeholder={settings().searchPlaceholder}
							value={searchQuery()}
							onPointerDown={(): void => {
								if (!settings().keyboardEnabled) return;

								setKeyboardOpen(true);
								setPortraitReaderOpen(false);
							}}
							onInput={(event): void => {
								setSearchQuery(event.currentTarget.value);
							}}
						/>
						<Show when={searchQuery()}>
							<button
								type="button"
								aria-label="Clear search"
								onClick={(): void => {
									setSearchQuery('');
								}}
							>
								<Icon name="close" />
							</button>
						</Show>
						<Show when={settings().keyboardEnabled}>
							<button
								type="button"
								aria-label="Open on-screen keyboard"
								onClick={(): void => {
									setKeyboardOpen(true);
									setPortraitReaderOpen(false);
								}}
							>
								<Icon name="keyboard" />
							</button>
						</Show>
					</div>
					<span class={style['directory-separator']} aria-hidden="true" data-preview-id="directory-content-separator" />

					<div
						class={style['document-list']}
						aria-live="polite"
						data-preview-allow-overflow=""
						data-preview-id="document-list"
					>
						<Show
							when={visibleDocuments().length > 0}
							fallback={
								<div class={style.empty}>
									<Icon name="pdf" />
									<strong>{availableDocuments().length === 0 ? 'No documents available' : 'No documents found'}</strong>
									<span>
										{availableDocuments().length === 0
											? 'Documents will appear here when the datasource has entries.'
											: 'Try another category or clear the search.'}
									</span>
								</div>
							}
						>
							<For each={visibleDocuments()}>
								{(document: DocumentRecord): JSX.Element => (
									<button
										class={`${style['document-row']} ${selectedDocumentId() === document.id ? style.selected : ''} ${!document.pdf ? style.unavailable : ''}`}
										data-preview-id="document-row"
										data-selected={selectedDocumentId() === document.id}
										type="button"
										disabled={!document.pdf}
										onClick={(): void => {
											batch((): void => {
												if (surface() === 'portrait') setPortraitReaderOpen(true);
												setSelectedDocumentId(document.id);
												setKeyboardOpen(false);
											});
										}}
									>
										<Show when={settings().showDirectoryIcon}>
											<span class={style['pdf-icon']} aria-hidden="true" data-preview-id="document-icon">
												<Show when={customDirectoryIconVisible()} fallback={<Icon name="pdf" />}>
													<img
														src={directoryIconUrl()}
														alt=""
														onError={(): void => {
															setDirectoryIconFailed(true);
														}}
													/>
												</Show>
											</span>
										</Show>
										<span class={style['row-copy']}>
											<strong data-text-role="document-title">{document.title}</strong>
											<span class={style.metadata}>
												<For each={document.metadata.slice(0, 6)}>
													{(metadata: DocumentMetadataValue): JSX.Element => (
														<small data-text-role="document-metadata">
															<b>{metadata.label}</b> {formatDocumentValue(metadata, settings().dateFormat)}
														</small>
													)}
												</For>
											</span>
										</span>
										<span class={style['row-arrow']} aria-hidden="true">
											<Icon name="chevron-right" />
										</span>
									</button>
								)}
							</For>
						</Show>
					</div>

					<Show when={keyboardOpen() && surface() !== 'portrait'}>
						<div class={style['keyboard-shell']}>
							<span class={style['keyboard-separator']} aria-hidden="true" data-preview-id="keyboard-separator" />
							{renderKeyboard('directory')}
						</div>
					</Show>
				</aside>

				<Show when={portraitReaderVisible()}>
					<section class={style.reader} aria-label="PDF document viewer">
						<div class={style['reader-heading']}>
							<div>
								<span>Now viewing</span>
								<strong data-text-role="document-title">{selectedDocument()?.title ?? 'Select a document'}</strong>
							</div>
							<small>{selectedDocument()?.category ?? 'Document viewer'}</small>
						</div>
						<div class={style['viewer-frame']} data-preview-id="viewer-frame">
							<PdfViewer
								class={style.viewer}
								onController={(value: PdfViewerController): void => {
									setController(() => value);
								}}
								onStateChange={setViewerState}
								options={viewerOptions()}
								sources={activePdfSources()}
							/>
							<Show when={!selectedDocument()?.pdf || sourceError() || viewerState().error}>
								<div class={style['viewer-message']} role="status">
									<Icon name="pdf" />
									<strong>{selectedDocument() ? 'PDF unavailable' : 'Choose a document'}</strong>
									<span>
										{sourceError() || viewerState().error || 'Select an entry from the directory to begin reading.'}
									</span>
								</div>
							</Show>
						</div>

						<Show when={settings().showControls && Boolean(selectedDocument()?.pdf)}>
							<nav class={style.controls} aria-label="PDF navigation" data-preview-allow-overflow="">
								<button type="button" aria-label="First page" onClick={(): void => controller()?.firstPage()}>
									<Icon name="first-page" />
									<span>First</span>
								</button>
								<button type="button" aria-label="Previous page" onClick={(): void => controller()?.previousPage()}>
									<Icon name="chevron-left" />
									<span>Back</span>
								</button>
								<div class={style['page-readout']} data-text-role="page-readout" aria-live="polite">
									<strong>{viewerState().currentDocumentPage || 0}</strong>
									<span>of {viewerState().pagesInCurrentDocument || 0}</span>
								</div>
								<button type="button" aria-label="Next page" onClick={(): void => controller()?.nextPage()}>
									<Icon name="chevron-right" />
									<span>Next</span>
								</button>
								<button type="button" aria-label="Last page" onClick={(): void => controller()?.lastPage()}>
									<Icon name="last-page" />
									<span>Last</span>
								</button>
								<span class={style['control-separator']} aria-hidden="true" data-preview-id="zoom-control-separator" />
								<button type="button" aria-label="Zoom out" onClick={(): void => controller()?.zoomOut()}>
									<Icon name="zoom-out" />
								</button>
								<div
									class={style['zoom-readout']}
									aria-label={`Zoom ${Math.round(viewerState().zoom * 100)} percent`}
									data-preview-id="zoom-readout"
								>
									{Math.round(viewerState().zoom * 100)}%
								</div>
								<button type="button" aria-label="Zoom in" onClick={(): void => controller()?.zoomIn()}>
									<Icon name="zoom-in" />
								</button>
							</nav>
						</Show>
					</section>
				</Show>
			</main>

			<Show when={keyboardOpen() && surface() === 'portrait'}>
				<div class={`${style['keyboard-shell']} ${style['page-keyboard']}`}>
					<span class={style['keyboard-separator']} aria-hidden="true" data-preview-id="keyboard-separator" />
					{renderKeyboard('page')}
				</div>
			</Show>

			<Show when={screensaverVisible()}>
				<button class={style.screensaver} data-preview-id="screensaver" type="button" onClick={registerActivity}>
					<Show when={screensaverImageUrl()}>
						<img src={screensaverImageUrl()} alt="" data-preview-id="screensaver-background" />
					</Show>
					<span aria-hidden="true" class={style['screensaver-shade']} data-preview-id="screensaver-overlay" />
					<Show when={customScreensaverLogoVisible()}>
						<img
							class={style['screensaver-logo']}
							data-preview-id="screensaver-logo"
							src={screensaverLogoUrl()}
							alt={`${settings().appTitle} logo`}
							onError={(): void => {
								setScreensaverLogoFailed(true);
							}}
						/>
					</Show>
					<span class={style['screensaver-content']} data-preview-id="screensaver-content">
						<Icon name="touch" />
						<strong>{settings().screensaverMessage}</strong>
						<small data-preview-id="screensaver-subtext" data-text-role="screensaver-subtext">
							{settings().screensaverSubtext}
						</small>
					</span>
				</button>
			</Show>
		</section>
	);
};
