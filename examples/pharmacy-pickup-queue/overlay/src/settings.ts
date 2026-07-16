import type { ConfigValues, Settings } from '@interfaces/application.interface';

import {
	mixHexColors,
	readableTextColor,
	resolveTheme,
	themePresetSetting
} from '@utils/theme';
import type { ThemePreset } from '@utils/theme';

interface PharmacyPalette extends Record<string, string> {
	backgroundColor: string;
	heroBackgroundColor: string;
	surfaceColor: string;
	primaryTextColor: string;
	secondaryTextColor: string;
	accentColor: string;
	alertColor: string;
}

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	const themePreset: ThemePreset = themePresetSetting(config.themePreset);
	const palette: PharmacyPalette = resolveTheme(themePreset, {
		dark: {
			backgroundColor: '#0b1714',
			heroBackgroundColor: '#0d6b59',
			surfaceColor: '#172520',
			primaryTextColor: '#f4f8f6',
			secondaryTextColor: '#a9bbb4',
			accentColor: '#f2c14e',
			alertColor: '#f28c6d'
		},
		light: {
			backgroundColor: '#e9f1ed',
			heroBackgroundColor: '#07594b',
			surfaceColor: '#ffffff',
			primaryTextColor: '#17372f',
			secondaryTextColor: '#52675f',
			accentColor: '#8a5a00',
			alertColor: '#b34332'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#e9f1ed'),
			heroBackgroundColor: textSetting(config.heroBackgroundColor, '#07594b'),
			surfaceColor: textSetting(config.surfaceColor, '#ffffff'),
			primaryTextColor: textSetting(config.primaryTextColor, '#17372f'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#52675f'),
			accentColor: textSetting(config.accentColor, '#8a5a00'),
			alertColor: textSetting(config.alertColor, '#b34332')
		}
	});
	const heroTextColor: string = readableTextColor(palette.heroBackgroundColor);

	return {
		pharmacyName: textSetting(config.pharmacyName, 'Greenline Pharmacy'),
		emptyStateText: textSetting(config.emptyStateText, 'No pickup tickets are waiting.'),
		themePreset,
		...palette,
		heroTextColor,
		heroMutedTextColor: mixHexColors(palette.heroBackgroundColor, heroTextColor, 0.72),
		dividerColor: mixHexColors(palette.surfaceColor, palette.primaryTextColor, 0.16),
		accentTextColor: readableTextColor(palette.accentColor),
		alertTextColor: readableTextColor(palette.alertColor)
	};
}
