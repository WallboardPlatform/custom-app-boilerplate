import type { ConfigValues, Settings } from '@interfaces/application.interface';

import {
	readableTextColor,
	resolveTheme,
	themePresetSetting
} from '@utils/theme';
import type { ThemePalettes, ThemePreset } from '@utils/theme';

interface RecognitionPalette extends Record<string, string> {
	backgroundColor: string;
	surfaceColor: string;
	textColor: string;
	mutedTextColor: string;
	accentColor: string;
	highlightColor: string;
	coolColor: string;
}

const LIGHT_PALETTE: RecognitionPalette = {
	backgroundColor: '#f4f0e8',
	surfaceColor: '#fffaf2',
	textColor: '#18362f',
	mutedTextColor: '#5e6c66',
	accentColor: '#e95545',
	highlightColor: '#f5c84c',
	coolColor: '#2775bd'
};

const DARK_PALETTE: RecognitionPalette = {
	backgroundColor: '#142820',
	surfaceColor: '#f1eadf',
	textColor: '#f7f0e4',
	mutedTextColor: '#b7c7bd',
	accentColor: '#f16a58',
	highlightColor: '#f1c453',
	coolColor: '#4d91cf'
};

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	const numericValue: number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

	return Math.min(maximum, Math.max(minimum, numericValue));
};

const booleanSetting = (value: boolean | undefined, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

export default (config: ConfigValues): Settings => {
	const themePreset: ThemePreset = themePresetSetting(config.themePreset);
	const customPalette: RecognitionPalette = {
		backgroundColor: textSetting(config.backgroundColor, LIGHT_PALETTE.backgroundColor),
		surfaceColor: textSetting(config.surfaceColor, LIGHT_PALETTE.surfaceColor),
		textColor: textSetting(config.textColor, LIGHT_PALETTE.textColor),
		mutedTextColor: textSetting(config.mutedTextColor, LIGHT_PALETTE.mutedTextColor),
		accentColor: textSetting(config.accentColor, LIGHT_PALETTE.accentColor),
		highlightColor: textSetting(config.highlightColor, LIGHT_PALETTE.highlightColor),
		coolColor: textSetting(config.coolColor, LIGHT_PALETTE.coolColor)
	};
	const palettes: ThemePalettes<RecognitionPalette> = {
		dark: DARK_PALETTE,
		light: LIGHT_PALETTE,
		custom: customPalette
	};
	const palette: RecognitionPalette = resolveTheme(themePreset, palettes);

	return {
		studioName: textSetting(config.studioName, 'Paper Kite Studio'),
		wallTitle: textSetting(config.wallTitle, 'Work worth celebrating'),
		emptyStateText: textSetting(config.emptyStateText, 'Fresh recognition is taking shape.'),
		pageDurationSeconds: numberSetting(config.pageDurationSeconds, 8, 3, 60),
		showQuotes: booleanSetting(config.showQuotes, true),
		themePreset,
		...palette,
		surfaceInkColor: readableTextColor(palette.surfaceColor),
		accentInkColor: readableTextColor(palette.accentColor),
		highlightInkColor: readableTextColor(palette.highlightColor),
		coolInkColor: readableTextColor(palette.coolColor)
	};
};
