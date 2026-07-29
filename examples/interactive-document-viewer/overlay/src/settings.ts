import type { ConfigValues, Settings } from '@interfaces/application.interface';

const text = (value: unknown, fallback: string): string =>
	typeof value === 'string' && value.trim() ? value.trim() : fallback;

const optionalText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const number = (value: unknown, fallback: number, minimum: number, maximum: number): number => {
	const numeric: number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

	return Math.min(maximum, Math.max(minimum, numeric));
};

const boolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);

export default (config: ConfigValues): Settings => ({
	appTitle: text(config.appTitle, 'Community Documents'),
	backgroundColor: text(config.backgroundColor, '#ffffff'),
	backgroundColorTwo: text(config.backgroundColorTwo, '#eef6ff'),
	backgroundImage: config.backgroundImage,
	backgroundMode:
		config.backgroundMode === 'solid' || config.backgroundMode === 'image' ? config.backgroundMode : 'gradient',
	buttonColor: text(config.buttonColor, '#0a2d6f'),
	buttonTextColor: text(config.buttonTextColor, '#ffffff'),
	categoryColumn: text(config.categoryColumn, 'Category'),
	dateFormat: config.dateFormat === 'medium' || config.dateFormat === 'numeric' ? config.dateFormat : 'long',
	directoryIconFile: config.directoryIconFile,
	eyebrowText: text(config.eyebrowText, 'Public information kiosk'),
	fit: ['actual', 'contain', 'cover', 'fill', 'height', 'width'].includes(config.fit ?? '')
		? (config.fit as Settings['fit'])
		: 'contain',
	idleSeconds: number(config.idleSeconds, 120, 15, 1800),
	interactiveAnnotations: boolean(config.interactiveAnnotations, true),
	keyboardColor: text(config.keyboardColor, '#ffffff'),
	keyboardEnabled: boolean(config.keyboardEnabled, true),
	keyboardKeyColor: text(config.keyboardKeyColor, '#e8eef5'),
	keyboardTextScale: number(config.keyboardTextScale, 100, 80, 150),
	listColor: text(config.listColor, '#ffffff'),
	logoFile: config.logoFile,
	metadataColumns: [
		optionalText(config.metadataColumn1) || 'Date',
		optionalText(config.metadataColumn2) || 'Category',
		optionalText(config.metadataColumn3),
		optionalText(config.metadataColumn4),
		optionalText(config.metadataColumn5),
		optionalText(config.metadataColumn6)
	].filter(Boolean),
	mutedTextColor: text(config.mutedTextColor, '#60708a'),
	pageMode: config.pageMode === 'continuous' ? 'continuous' : 'single',
	panelColor: text(config.panelColor, '#09265f'),
	pdfColumn: text(config.pdfColumn, 'PDF'),
	portraitReaderAfterSelection: boolean(config.portraitReaderAfterSelection, true),
	portraitReaderFirst: boolean(config.portraitReaderFirst, true),
	primaryTextColor: text(config.primaryTextColor, '#14233a'),
	renderForms: boolean(config.renderForms, true),
	renderTextLayer: boolean(config.renderTextLayer, true),
	scheduleColumn: typeof config.scheduleColumn === 'string' ? config.scheduleColumn.trim() : 'Scheduling',
	scheduleRetentionDays: Math.floor(number(config.scheduleRetentionDays, 0, 0, 3650)),
	screensaverEnabled: boolean(config.screensaverEnabled, true),
	screensaverImage: config.screensaverImage,
	screensaverLogoFile: config.screensaverLogoFile,
	screensaverMessage: text(config.screensaverMessage, 'Touch anywhere to explore community documents'),
	screensaverOverlayColor: text(config.screensaverOverlayColor, '#051b45'),
	screensaverSubtext: text(config.screensaverSubtext, 'Tap or press any key to begin'),
	searchPlaceholder: text(config.searchPlaceholder, 'Search documents'),
	showAccessibilityButton: boolean(config.showAccessibilityButton, false),
	showAppTitle: boolean(config.showAppTitle, false),
	showClock: boolean(config.showClock, true),
	showControls: boolean(config.showControls, true),
	showDirectoryIcon: boolean(config.showDirectoryIcon, true),
	showEyebrow: boolean(config.showEyebrow, false),
	timeFormat: config.timeFormat === '24' ? '24' : '12',
	titleColumn: text(config.titleColumn, 'Name'),
	zoomMaximum: number(config.zoomMaximum, 4, 1, 10),
	zoomMinimum: number(config.zoomMinimum, 0.5, 0.1, 1),
	zoomStep: number(config.zoomStep, 0.2, 0.05, 1)
});
