import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { motionPreset } from '@utils/motion';
import { mixHexColors, readableTextColor, resolveTheme, themePresetSetting } from '@utils/theme';
import type { ThemePalettes, ThemePreset } from '@utils/theme';

interface BoardPalette extends Record<string, string> {
	backgroundColor: string;
	panelColor: string;
	wellColor: string;
	textColor: string;
	mutedTextColor: string;
	accentColor: string;
}

const DARK_PALETTE: BoardPalette = {
	backgroundColor: '#151B1B',
	panelColor: '#1C2424',
	wellColor: '#0E1212',
	textColor: '#EAEAEA',
	mutedTextColor: '#738084',
	accentColor: '#D1202C'
};

const LIGHT_PALETTE: BoardPalette = {
	backgroundColor: '#F3EDE5',
	panelColor: '#E8DECF',
	wellColor: '#EDE5D8',
	textColor: '#14110E',
	mutedTextColor: '#5A4E42',
	accentColor: '#D1202C'
};

const textSetting = (value: unknown, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

const optionalTextSetting = (value: unknown): string => {
	return typeof value === 'string' ? value : '';
};

const booleanSetting = (value: unknown, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

export default (config: ConfigValues): Settings => {
	const preset: ThemePreset = themePresetSetting(config.themePreset ?? 'dark');
	const palettes: ThemePalettes<BoardPalette> = {
		dark: DARK_PALETTE,
		light: LIGHT_PALETTE,
		custom: {
			backgroundColor: textSetting(config.backgroundColor, DARK_PALETTE.backgroundColor),
			panelColor: textSetting(config.panelColor, DARK_PALETTE.panelColor),
			wellColor: textSetting(config.wellColor, DARK_PALETTE.wellColor),
			textColor: textSetting(config.textColor, DARK_PALETTE.textColor),
			mutedTextColor: textSetting(config.mutedTextColor, DARK_PALETTE.mutedTextColor),
			accentColor: textSetting(config.accentColor, DARK_PALETTE.accentColor)
		}
	};
	const palette: BoardPalette = resolveTheme(preset, palettes);
	const dividerColor: string = preset === 'dark'
		? '#0B0F0F'
		: preset === 'light'
			? '#D9CDBA'
			: mixHexColors(palette.panelColor, readableTextColor(palette.panelColor), 0.18);

	return {
		dividerColor,
		scopeTitle: textSetting(config.scopeTitle, 'All Team'),
		memberFilter: optionalTextSetting(config.memberFilter),
		requirePhoto: booleanSetting(config.requirePhoto, true),
		showHeader: booleanSetting(config.showHeader, true),
		showTicker: booleanSetting(config.showTicker, true),
		showOfflineZone: booleanSetting(config.showOfflineZone, true),
		themePreset: preset,
		motionPreset: motionPreset(config.motionPreset ?? 'expressive'),
		...palette
	};
};
