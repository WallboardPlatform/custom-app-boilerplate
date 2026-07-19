import type { ConfigValues, Settings } from '@interfaces/application.interface';

const text = (value: unknown, fallback: string): string => {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const number = (value: unknown, fallback: number, minimum: number, maximum: number): number => {
	const numeric: number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

	return Math.min(maximum, Math.max(minimum, numeric));
};

const boolean = (value: unknown, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

export default (config: ConfigValues): Settings => ({
	accentColor: text(config.accentColor, '#42d6b5'),
	autoScrollEnabled: boolean(config.autoScrollEnabled, false),
	autoScrollEndPauseSeconds: number(config.autoScrollEndPauseSeconds, 3, 0, 60),
	autoScrollPauseOnHover: boolean(config.autoScrollPauseOnHover, true),
	autoScrollRewindSeconds: number(config.autoScrollRewindSeconds, 1.5, 0, 15),
	autoScrollSpeed: number(config.autoScrollSpeed, 36, 1, 500),
	backgroundColor: text(config.backgroundColor, '#101514'),
	borderColor: text(config.borderColor, '#34413e'),
	fit: ['actual', 'contain', 'cover', 'fill', 'height', 'width'].includes(config.fit ?? '')
		? config.fit as Settings['fit']
		: 'contain',
	hideScrollbars: boolean(config.hideScrollbars, false),
	initialPage: number(config.initialPage, 1, 1, 10000),
	interactiveAnnotations: boolean(config.interactiveAnnotations, true),
	mutedTextColor: text(config.mutedTextColor, '#9caaa6'),
	pageEnd: number(config.pageEnd, 0, 0, 10000),
	pageMode: config.pageMode === 'single' ? 'single' : 'continuous',
	pagePadding: number(config.pagePadding, 18, 0, 120),
	pageStart: number(config.pageStart, 1, 1, 10000),
	panelColor: text(config.panelColor, '#18201e'),
	password: text(config.password, ''),
	pdfFile: config.pdfFile,
	pdfFolder: config.pdfFolder,
	preloadScreens: number(config.preloadScreens, 1, 0, 6),
	primaryTextColor: text(config.primaryTextColor, '#f5f2e9'),
	recursiveFolder: boolean(config.recursiveFolder, true),
	renderForms: boolean(config.renderForms, true),
	renderTextLayer: boolean(config.renderTextLayer, true),
	scrollDirection: config.scrollDirection === 'horizontal' ? 'horizontal' : 'vertical',
	separatorColor: text(config.separatorColor, '#27322f'),
	separatorSize: number(config.separatorSize, 1, 0, 24),
	showControls: boolean(config.showControls, true),
	showSidebar: boolean(config.showSidebar, true),
	sidebarDefault: config.sidebarDefault === 'outline' || config.sidebarDefault === 'search'
		? config.sidebarDefault
		: 'documents',
	sourceMode: config.sourceMode === 'folder' ? 'folder' : 'file',
	themePreset: config.themePreset === 'light' || config.themePreset === 'custom' ? config.themePreset : 'dark',
	title: text(config.title, 'Document workspace'),
	toolbarColor: text(config.toolbarColor, '#121918'),
	zoomMaximum: number(config.zoomMaximum, 4, 1, 10),
	zoomMinimum: number(config.zoomMinimum, 0.35, 0.1, 1),
	zoomStep: number(config.zoomStep, 0.15, 0.05, 1)
});
