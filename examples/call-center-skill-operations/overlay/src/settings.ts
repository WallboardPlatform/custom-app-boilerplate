import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	const palette = resolveTheme(themePresetSetting(config.themePreset), {
		dark: {
			backgroundColor: '#071b29',
			surfaceColor: '#0f2a3a',
			primaryTextColor: '#f2f7f9',
			secondaryTextColor: '#8fa8b8',
			readyColor: '#3ad0a0',
			activeColor: '#45a9e6',
			acwColor: '#efb84b',
			awayColor: '#ef8151',
			offlineColor: '#647985',
			unknownColor: '#8c7bd3'
		},
		light: {
			backgroundColor: '#e9f0f4',
			surfaceColor: '#ffffff',
			primaryTextColor: '#183549',
			secondaryTextColor: '#687f8e',
			readyColor: '#258f6f',
			activeColor: '#267ea8',
			acwColor: '#b47b14',
			awayColor: '#c45f32',
			offlineColor: '#7a8c97',
			unknownColor: '#6d5ca8'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#071b29'),
			surfaceColor: textSetting(config.surfaceColor, '#0f2a3a'),
			primaryTextColor: textSetting(config.primaryTextColor, '#f2f7f9'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#8fa8b8'),
			readyColor: textSetting(config.readyColor, '#3ad0a0'),
			activeColor: textSetting(config.activeColor, '#45a9e6'),
			acwColor: textSetting(config.acwColor, '#efb84b'),
			awayColor: textSetting(config.awayColor, '#ef8151'),
			offlineColor: textSetting(config.offlineColor, '#647985'),
			unknownColor: textSetting(config.unknownColor, '#8c7bd3')
		}
	});

	return {
		title: textSetting(config.titleText, 'Skill operations'),
		subtitle: textSetting(config.subtitleText, 'Live coverage and agent activity'),
		emptyState: textSetting(config.emptyStateText, 'No active skill records are currently available.'),
		rotationSeconds: Math.max(3, Number(config.rotationSeconds) || 10),
		maxAgentsShown: Math.max(4, Math.min(24, Number(config.maxAgentsShown) || 12)),
		fontFamily: textSetting(config.fontFamily, '\'Segoe UI\', Arial, sans-serif'),
		...palette
	};
}
