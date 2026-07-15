import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	const parsedValue: number = Number(value);

	if (!Number.isFinite(parsedValue)) {
		return fallback;
	}

	return Math.min(maximum, Math.max(minimum, Math.round(parsedValue)));
};

export default function mapSettings(config: ConfigValues): Settings {
	const palette = resolveTheme(themePresetSetting(config.themePreset), {
		dark: {
			backgroundColor: '#101716', panelColor: '#17211f', primaryTextColor: '#f9f7f0',
			secondaryTextColor: '#b9c4bf', accentColor: '#ef6a55'
		},
		light: {
			backgroundColor: '#f2efe8', panelColor: '#fffdf8', primaryTextColor: '#17211f',
			secondaryTextColor: '#68756f', accentColor: '#c94d3b'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#f2efe8'),
			panelColor: textSetting(config.panelColor, '#17211f'),
			primaryTextColor: textSetting(config.primaryTextColor, '#f9f7f0'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#b9c4bf'),
			accentColor: textSetting(config.accentColor, '#ef5b45')
		}
	});

	return {
		sourceLabel: textSetting(config.sourceLabel, 'Field notes'),
		emptyStateText: textSetting(config.emptyStateText, 'No stories are available.'),
		rotationSeconds: numberSetting(config.rotationSeconds, 8, 2, 120),
		maxStories: numberSetting(config.maxStories, 6, 1, 12),
		showDescription: config.showDescription !== false,
		showTimestamp: config.showTimestamp !== false,
		imagePosition: config.imagePosition === 'right' ? 'right' : 'left',
		...palette
	};
}
