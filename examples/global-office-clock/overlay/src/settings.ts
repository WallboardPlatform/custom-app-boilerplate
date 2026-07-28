import type { ConfigValues, HourFormat, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const booleanSetting = (value: boolean | undefined, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

const timeFormatSetting = (value: string | undefined): HourFormat => value === '12' ? '12' : '24';

export default (config: ConfigValues): Settings => {
	const palette = resolveTheme(themePresetSetting(config.themePreset ?? 'light'), {
		dark: {
			backgroundColor: '#12100d',
			surfaceColor: '#1b1815',
			primaryTextColor: '#f4f1ea',
			secondaryTextColor: '#a2988a',
			accentColor: '#d8a657',
			dividerColor: '#2f2a25'
		},
		light: {
			backgroundColor: '#f3efe6',
			surfaceColor: '#fffdf8',
			primaryTextColor: '#14110e',
			secondaryTextColor: '#6d6357',
			accentColor: '#9a6316',
			dividerColor: '#ddd4c4'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#f3ede5'),
			surfaceColor: textSetting(config.surfaceColor, '#fffdf8'),
			primaryTextColor: textSetting(config.primaryTextColor, '#14110e'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#6d6357'),
			accentColor: textSetting(config.accentColor, '#9a6316'),
			dividerColor: textSetting(config.dividerColor, '#ddd4c4')
		}
	});

	return {
		boardTitle: textSetting(config.boardTitle, 'Global offices'),
		timeFormat: timeFormatSetting(config.timeFormat),
		showSeconds: booleanSetting(config.showSeconds, false),
		showOpenState: booleanSetting(config.showOpenState, true),
		emptyStateText: textSetting(config.emptyStateText, 'No offices are configured yet.'),
		...palette
	};
};
