import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

const numberSetting = (value: unknown, fallback: number, minimum: number, maximum: number): number => {
	const numeric: number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

	return Math.min(maximum, Math.max(minimum, numeric));
};

export default (config: ConfigValues): Settings => {
	const themePreset = themePresetSetting(config.themePreset);
	const palette = resolveTheme(themePreset, {
		dark: {
			backgroundColor: '#111615',
			surfaceColor: '#1c2422',
			primaryTextColor: '#f4f6f2',
			secondaryTextColor: '#a6b2ae',
			normalColor: '#35c879',
			attentionColor: '#f0b43a',
			stoppedColor: '#f05252',
			unknownColor: '#8c9a9e'
		},
		light: {
			backgroundColor: '#eef1ee',
			surfaceColor: '#ffffff',
			primaryTextColor: '#111817',
			secondaryTextColor: '#596461',
			normalColor: '#087847',
			attentionColor: '#a96100',
			stoppedColor: '#bc2432',
			unknownColor: '#667378'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#111615'),
			surfaceColor: textSetting(config.surfaceColor, '#1c2422'),
			primaryTextColor: textSetting(config.primaryTextColor, '#f4f6f2'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#a6b2ae'),
			normalColor: textSetting(config.normalColor, '#35c879'),
			attentionColor: textSetting(config.attentionColor, '#f0b43a'),
			stoppedColor: textSetting(config.stoppedColor, '#f05252'),
			unknownColor: textSetting(config.unknownColor, '#8c9a9e')
		}
	});

	return {
		boardTitle: textSetting(config.boardTitle, 'NORTHSTAR ASSEMBLY'),
		boardSubtitle: textSetting(config.boardSubtitle, 'PRODUCTION ANDON'),
		emptyStateText: textSetting(config.emptyStateText, 'No station status rows are available.'),
		pageDurationSeconds: numberSetting(config.pageDurationSeconds, 10, 3, 120),
		themePreset,
		...palette
	};
};
