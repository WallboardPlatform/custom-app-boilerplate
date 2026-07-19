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
	accentColor: text(config.accentColor, '#ff5a3d'),
	advanceOnError: boolean(config.advanceOnError, true),
	autoplay: boolean(config.autoplay, true),
	backgroundColor: text(config.backgroundColor, '#080b0d'),
	fit: config.fit === 'contain' || config.fit === 'fill' ? config.fit : 'cover',
	muted: boolean(config.muted, true),
	mutedTextColor: text(config.mutedTextColor, '#b8c0c5'),
	playlistJson: text(config.playlistJson, ''),
	primaryTextColor: text(config.primaryTextColor, '#f5f2e9'),
	programName: text(config.programName, 'Night signal'),
	recursiveFolder: boolean(config.recursiveFolder, true),
	repeat: config.repeat === 'none' || config.repeat === 'item' ? config.repeat : 'playlist',
	retryCount: Math.round(number(config.retryCount, 2, 0, 5)),
	showCaptions: boolean(config.showCaptions, true),
	showChrome: boolean(config.showChrome, true),
	showControls: boolean(config.showControls, false),
	sourceMode: config.sourceMode === 'folder' || config.sourceMode === 'playlist' ? config.sourceMode : 'file',
	startAtSeconds: number(config.startAtSeconds, 0, 0, 86400),
	themePreset: config.themePreset === 'light' || config.themePreset === 'custom' ? config.themePreset : 'dark',
	venueName: text(config.venueName, 'Lumen public media'),
	videoFile: config.videoFile,
	videoFolder: config.videoFolder,
	volume: number(config.volume, 0, 0, 100)
});
