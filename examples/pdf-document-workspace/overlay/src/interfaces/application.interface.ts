import type { PdfFitMode, PdfPageMode, PdfScrollDirection } from '../capabilities/pdf';

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Config {
	configValues: ConfigValues;
}

export interface Settings extends Record<string, unknown> {
	accentColor: string;
	autoScrollEnabled: boolean;
	autoScrollEndPauseSeconds: number;
	autoScrollPauseOnHover: boolean;
	autoScrollRewindSeconds: number;
	autoScrollSpeed: number;
	backgroundColor: string;
	borderColor: string;
	fit: PdfFitMode;
	hideScrollbars: boolean;
	initialPage: number;
	interactiveAnnotations: boolean;
	mutedTextColor: string;
	pageEnd: number;
	pageMode: PdfPageMode;
	pagePadding: number;
	pageStart: number;
	panelColor: string;
	password: string;
	pdfFile?: unknown;
	pdfFolder?: unknown;
	preloadScreens: number;
	primaryTextColor: string;
	recursiveFolder: boolean;
	renderForms: boolean;
	renderTextLayer: boolean;
	scrollDirection: PdfScrollDirection;
	separatorColor: string;
	separatorSize: number;
	showControls: boolean;
	showSidebar: boolean;
	sidebarDefault: 'documents' | 'outline' | 'search';
	sourceMode: 'file' | 'folder';
	themePreset: 'dark' | 'light' | 'custom';
	title: string;
	toolbarColor: string;
	zoomMaximum: number;
	zoomMinimum: number;
	zoomStep: number;
}

export interface ConfigValues {
	accentColor?: string;
	autoScrollEnabled?: boolean;
	autoScrollEndPauseSeconds?: number;
	autoScrollPauseOnHover?: boolean;
	autoScrollRewindSeconds?: number;
	autoScrollSpeed?: number;
	backgroundColor?: string;
	borderColor?: string;
	fit?: string;
	hideScrollbars?: boolean;
	initialPage?: number;
	interactiveAnnotations?: boolean;
	mutedTextColor?: string;
	pageEnd?: number;
	pageMode?: string;
	pagePadding?: number;
	pageStart?: number;
	panelColor?: string;
	password?: string;
	pdfFile?: unknown;
	pdfFolder?: unknown;
	preloadScreens?: number;
	primaryTextColor?: string;
	recursiveFolder?: boolean;
	renderForms?: boolean;
	renderTextLayer?: boolean;
	scrollDirection?: string;
	separatorColor?: string;
	separatorSize?: number;
	showControls?: boolean;
	showSidebar?: boolean;
	sidebarDefault?: string;
	sourceMode?: string;
	themePreset?: string;
	title?: string;
	toolbarColor?: string;
	zoomMaximum?: number;
	zoomMinimum?: number;
	zoomStep?: number;
}
