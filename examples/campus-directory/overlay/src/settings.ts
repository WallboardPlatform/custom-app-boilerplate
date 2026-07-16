import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { mixHexColors, resolveTheme, themePresetSetting } from '@utils/theme';
import type { ThemePreset } from '@utils/theme';

interface DirectoryPalette {
	backgroundColor: string;
	textColor: string;
	accentColor: string;
	accessibilityColor: string;
	secondaryAccentColor: string;
	tertiaryAccentColor: string;
}

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	const numericValue: number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

	return Math.min(maximum, Math.max(minimum, numericValue));
};

export default function mapSettings(config: ConfigValues): Settings {
	const themePreset: ThemePreset = themePresetSetting(config.themePreset);
	const customBackground: string = textSetting(config.backgroundColor, '#f5f7f4');
	const customText: string = textSetting(config.textColor, '#17312c');
	const customAccent: string = textSetting(config.accentColor, '#007f6d');
	const customAccessibility: string = textSetting(config.accessibilityColor, '#4f7f21');
	const palette: DirectoryPalette = resolveTheme(themePreset, {
		dark: {
			backgroundColor: '#111b1d',
			textColor: '#f2f7f4',
			accentColor: '#64d3bc',
			accessibilityColor: '#a2dc71',
			secondaryAccentColor: '#6ea9dc',
			tertiaryAccentColor: '#f0a064'
		},
		light: {
			backgroundColor: '#f5f7f4',
			textColor: '#17312c',
			accentColor: '#007f6d',
			accessibilityColor: '#4f7f21',
			secondaryAccentColor: '#286a9d',
			tertiaryAccentColor: '#c95f42'
		},
		custom: {
			backgroundColor: customBackground,
			textColor: customText,
			accentColor: customAccent,
			accessibilityColor: customAccessibility,
			secondaryAccentColor: mixHexColors(customAccent, customText, 0.34),
			tertiaryAccentColor: mixHexColors(customAccessibility, customAccent, 0.48)
		}
	});

	return {
		themePreset,
		campusName: textSetting(config.campusName, 'Rivermark College'),
		directoryTitle: textSetting(config.directoryTitle, 'Campus Directory'),
		locationLabel: textSetting(config.locationLabel, 'Welcome Center Lobby'),
		emptyStateText: textSetting(config.emptyStateText, 'No directory entries are available.'),
		pageDurationSeconds: numberSetting(config.pageDurationSeconds, 12, 3, 60),
		...palette
	};
}
