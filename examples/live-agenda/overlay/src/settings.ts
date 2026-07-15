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
			backgroundColor: '#101313', panelColor: '#1b2020', primaryTextColor: '#f5f2e9',
			secondaryTextColor: '#aeb8b4', accentColor: '#64e3bd', liveColor: '#ff6b5f'
		},
		light: {
			backgroundColor: '#eef3f1', panelColor: '#ffffff', primaryTextColor: '#17322e',
			secondaryTextColor: '#667a74', accentColor: '#238d70', liveColor: '#d94c43'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#101313'),
			panelColor: textSetting(config.panelColor, '#1b2020'),
			primaryTextColor: textSetting(config.primaryTextColor, '#f5f2e9'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#aeb8b4'),
			accentColor: textSetting(config.accentColor, '#64e3bd'),
			liveColor: textSetting(config.liveColor, '#ff6b5f')
		}
	});

	return {
		venueName: textSetting(config.venueName, 'North Hall'),
		boardTitle: textSetting(config.boardTitle, 'Today at the forum'),
		upcomingTitle: textSetting(config.upcomingTitle, 'Coming up'),
		emptyStateText: textSetting(config.emptyStateText, 'No more events are scheduled.'),
		maxUpcoming: numberSetting(config.maxUpcoming, 4, 1, 6),
		timeFormat: config.timeFormat === '12h' ? '12h' : '24h',
		showClock: config.showClock !== false,
		...palette
	};
}
