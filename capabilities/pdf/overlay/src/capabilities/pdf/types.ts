export type PdfFitMode = 'actual' | 'contain' | 'cover' | 'fill' | 'height' | 'width';
export type PdfPageMode = 'continuous' | 'single';
export type PdfScrollDirection = 'horizontal' | 'vertical';

export interface PdfSource {
	id: string;
	name: string;
	url: string;
	password?: string;
}

export interface PdfViewerOptions {
	autoScrollEnabled: boolean;
	autoScrollEndPauseSeconds: number;
	autoScrollPauseOnHover: boolean;
	autoScrollRewindSeconds: number;
	autoScrollSpeed: number;
	fit: PdfFitMode;
	hideScrollbars: boolean;
	initialPage: number;
	interactiveAnnotations: boolean;
	pageEnd: number;
	pageMode: PdfPageMode;
	pagePadding: number;
	pageStart: number;
	preloadScreens: number;
	renderForms: boolean;
	renderTextLayer: boolean;
	scrollDirection: PdfScrollDirection;
	separatorColor: string;
	separatorSize: number;
	zoomMaximum: number;
	zoomMinimum: number;
	zoomStep: number;
}

export interface PdfOutlineItem {
	destination: unknown;
	documentIndex: number;
	id: string;
	level: number;
	title: string;
}

export interface PdfPageDescriptor {
	documentIndex: number;
	documentName: string;
	globalIndex: number;
	height: number;
	id: string;
	pageNumber: number;
	pdfDocument: PdfDocumentProxy;
	source: PdfSource;
	width: number;
}

export interface PdfSearchMatch {
	documentIndex: number;
	globalPageIndex: number;
	occurrence: number;
	pageNumber: number;
	preview: string;
	query: string;
}

export interface PdfPageLayout {
	height: number;
	renderScale: number;
	renderedHeight: number;
	renderedWidth: number;
	transformHeight: number;
	transformWidth: number;
	width: number;
}

export interface PdfViewerState {
	currentDocumentIndex: number;
	currentDocumentName: string;
	currentDocumentPage: number;
	currentPage: number;
	documentCount: number;
	documents: PdfSource[];
	error: string;
	loading: boolean;
	outlines: PdfOutlineItem[];
	pageCount: number;
	pagesInCurrentDocument: number;
	searchIndex: number;
	searchMatches: PdfSearchMatch[];
	searchQuery: string;
	searching: boolean;
	zoom: number;
}

export interface PdfInteractionEvent {
	documentIndex: number;
	documentName: string;
	pageNumber: number;
	type: 'annotation' | 'click' | 'form-submit' | 'link' | 'page-change';
	value?: unknown;
}

export interface PdfViewerController {
	downloadCurrentDocument(): Promise<void>;
	firstPage(): void;
	goToDocument(documentIndex: number): void;
	goToDocumentPage(documentIndex: number, pageNumber: number): void;
	goToPage(pageNumber: number): void;
	jumpToOutline(item: PdfOutlineItem): Promise<void>;
	lastPage(): void;
	nextPage(): void;
	nextSearchMatch(): void;
	previousPage(): void;
	previousSearchMatch(): void;
	resetForms(): void;
	resetZoom(): void;
	search(query: string): Promise<PdfSearchMatch[]>;
	submitForms(): Record<string, string | string[]>;
	zoomIn(): void;
	zoomOut(): void;
}

export interface PdfViewport {
	clone(options?: { dontFlip?: boolean }): PdfViewport;
	height: number;
	transform: number[];
	width: number;
}

export interface PdfRenderTask {
	cancel(): void;
	promise: Promise<void>;
}

export interface PdfTextContentItem {
	str?: string;
}

export interface PdfTextContent {
	items: PdfTextContentItem[];
	styles?: Record<string, unknown>;
}

export interface PdfPageProxy {
	cleanup(): void;
	getAnnotations(options?: { intent?: string }): Promise<unknown[]>;
	getTextContent(): Promise<PdfTextContent>;
	getViewport(options: { scale: number }): PdfViewport;
	render(options: Record<string, unknown>): PdfRenderTask;
}

export interface PdfDocumentProxy {
	destroy(): Promise<void>;
	getData(): Promise<Uint8Array>;
	getDestination(name: string): Promise<unknown[] | null>;
	getMetadata(): Promise<{ info?: Record<string, unknown>; metadata?: { get(name: string): unknown } }>;
	getOutline(): Promise<unknown[] | null>;
	getPage(pageNumber: number): Promise<PdfPageProxy>;
	getPageIndex(reference: unknown): Promise<number>;
	numPages: number;
}

export interface PdfLoadingTask {
	destroy(): void;
	onPassword?: (updatePassword: (password: string) => void, reason: number) => void;
	promise: Promise<PdfDocumentProxy>;
}

export interface PdfJsLibrary {
	AnnotationLayer: {
		render(options: Record<string, unknown>): void;
		update?(options: Record<string, unknown>): void;
	};
	GlobalWorkerOptions: { workerSrc: string };
	getDocument(options: Record<string, unknown>): PdfLoadingTask;
	renderTextLayer(options: Record<string, unknown>): { cancel?(): void; promise?: Promise<void> };
	version: string;
}

export interface LoadedPdfCollection {
	documents: PdfDocumentProxy[];
	loadingTasks: PdfLoadingTask[];
	outlines: PdfOutlineItem[];
	pages: PdfPageDescriptor[];
	sources: PdfSource[];
}
