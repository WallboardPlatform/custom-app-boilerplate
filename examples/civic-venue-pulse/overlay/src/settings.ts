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
		light: {
			backgroundColor: '#f3efe6',
			surfaceColor: '#fffaf0',
			primaryTextColor: '#1f2421',
			secondaryTextColor: '#606a62',
			accentColor: '#9a4e2f',
			softAccentColor: '#d9b86f'
		},
		dark: {
			backgroundColor: '#121615',
			surfaceColor: '#202724',
			primaryTextColor: '#f6efe2',
			secondaryTextColor: '#b8c0b4',
			accentColor: '#d9855c',
			softAccentColor: '#e2c36e'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#f3efe6'),
			surfaceColor: textSetting(config.surfaceColor, '#fffaf0'),
			primaryTextColor: textSetting(config.primaryTextColor, '#1f2421'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#606a62'),
			accentColor: textSetting(config.accentColor, '#9a4e2f'),
			softAccentColor: textSetting(config.softAccentColor, '#d9b86f')
		}
	});

	return {
		venueName: textSetting(config.venueName, 'Foundry Arts Center'),
		boardLabel: textSetting(config.boardLabel, 'Today at the Foundry'),
		emptyStateText: textSetting(config.emptyStateText, 'No programs or announcements are scheduled right now.'),
		programRotationSeconds: numberSetting(config.programRotationSeconds, 10, 4, 120),
		announcementFreshHours: numberSetting(config.announcementFreshHours, 72, 1, 336),
		timeFormat: config.timeFormat === '24h' ? '24h' : '12h',
		showMedia: config.showMedia !== false,
		...palette
	};
}
