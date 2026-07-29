import type { PdfFitMode, PdfPageMode } from '../capabilities/pdf';

export interface DataSourceValue<T = unknown> {
	id?: string | null;
	value?: T;
}

export type DataSources = Record<string, DataSourceValue>;

export interface Config {
	configValues: ConfigValues;
}

export interface Settings extends Record<string, unknown> {
	appTitle: string;
	backgroundColor: string;
	backgroundColorTwo: string;
	backgroundImage?: unknown;
	backgroundMode: 'gradient' | 'image' | 'solid';
	buttonColor: string;
	buttonTextColor: string;
	categoryColumn: string;
	dateFormat: 'long' | 'medium' | 'numeric';
	directoryIconFile?: unknown;
	eyebrowText: string;
	fit: PdfFitMode;
	idleSeconds: number;
	interactiveAnnotations: boolean;
	keyboardColor: string;
	keyboardEnabled: boolean;
	keyboardKeyColor: string;
	keyboardTextScale: number;
	listColor: string;
	logoFile?: unknown;
	metadataColumns: string[];
	mutedTextColor: string;
	pageMode: PdfPageMode;
	panelColor: string;
	pdfColumn: string;
	portraitReaderAfterSelection: boolean;
	portraitReaderFirst: boolean;
	primaryTextColor: string;
	renderForms: boolean;
	renderTextLayer: boolean;
	scheduleColumn: string;
	scheduleRetentionDays: number;
	screensaverEnabled: boolean;
	screensaverImage?: unknown;
	screensaverLogoFile?: unknown;
	screensaverMessage: string;
	screensaverOverlayColor: string;
	screensaverSubtext: string;
	searchPlaceholder: string;
	showAccessibilityButton: boolean;
	showAppTitle: boolean;
	showClock: boolean;
	showControls: boolean;
	showDirectoryIcon: boolean;
	showEyebrow: boolean;
	timeFormat: '12' | '24';
	titleColumn: string;
	zoomMaximum: number;
	zoomMinimum: number;
	zoomStep: number;
}

export interface ConfigValues {
	appTitle?: string;
	backgroundColor?: string;
	backgroundColorTwo?: string;
	backgroundImage?: unknown;
	backgroundMode?: string;
	buttonColor?: string;
	buttonTextColor?: string;
	categoryColumn?: string;
	dateFormat?: string;
	directoryIconFile?: unknown;
	eyebrowText?: string;
	fit?: string;
	idleSeconds?: number;
	interactiveAnnotations?: boolean;
	keyboardColor?: string;
	keyboardEnabled?: boolean;
	keyboardKeyColor?: string;
	keyboardTextScale?: number;
	listColor?: string;
	logoFile?: unknown;
	metadataColumn1?: string;
	metadataColumn2?: string;
	metadataColumn3?: string;
	metadataColumn4?: string;
	metadataColumn5?: string;
	metadataColumn6?: string;
	mutedTextColor?: string;
	pageMode?: string;
	panelColor?: string;
	pdfColumn?: string;
	portraitReaderAfterSelection?: boolean;
	portraitReaderFirst?: boolean;
	primaryTextColor?: string;
	renderForms?: boolean;
	renderTextLayer?: boolean;
	scheduleColumn?: string;
	scheduleRetentionDays?: number;
	screensaverEnabled?: boolean;
	screensaverImage?: unknown;
	screensaverLogoFile?: unknown;
	screensaverMessage?: string;
	screensaverOverlayColor?: string;
	screensaverSubtext?: string;
	searchPlaceholder?: string;
	showAccessibilityButton?: boolean;
	showAppTitle?: boolean;
	showClock?: boolean;
	showControls?: boolean;
	showDirectoryIcon?: boolean;
	showEyebrow?: boolean;
	timeFormat?: string;
	titleColumn?: string;
	zoomMaximum?: number;
	zoomMinimum?: number;
	zoomStep?: number;
}
