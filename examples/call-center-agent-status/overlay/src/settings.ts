import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	const palette = resolveTheme(themePresetSetting(config.themePreset), {
		dark: {
			backgroundColor: '#0d1315',
			surfaceColor: '#1a2225',
			primaryTextColor: '#f5f2ea',
			secondaryTextColor: '#9aabb2',
			readyColor: '#4fd3a3',
			busyColor: '#ff6572',
			acwColor: '#f5bd52',
			awayColor: '#ef8a4c',
			offlineColor: '#82919a',
			unknownColor: '#62a7d9'
		},
		light: {
			backgroundColor: '#e8f0f6',
			surfaceColor: '#ffffff',
			primaryTextColor: '#18344b',
			secondaryTextColor: '#667d90',
			readyColor: '#2fa876',
			busyColor: '#dc5260',
			acwColor: '#d99a27',
			awayColor: '#d9753f',
			offlineColor: '#8293a0',
			unknownColor: '#3d86bd'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#e8f0f6'),
			surfaceColor: textSetting(config.surfaceColor, '#ffffff'),
			primaryTextColor: textSetting(config.primaryTextColor, '#18344b'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#667d90'),
			readyColor: textSetting(config.readyColor, '#2fa876'),
			busyColor: textSetting(config.busyColor, '#dc5260'),
			acwColor: textSetting(config.acwColor, '#d99a27'),
			awayColor: textSetting(config.awayColor, '#d9753f'),
			offlineColor: textSetting(config.offlineColor, '#8293a0'),
			unknownColor: textSetting(config.unknownColor, '#3d86bd')
		}
	});

	return {
		title: textSetting(config.titleText, 'Agent status wall'),
		subtitle: textSetting(config.subtitleText, 'Live workforce activity'),
		emptyState: textSetting(config.emptyStateText, 'No agent records are currently available.'),
		pageDurationSeconds: Math.max(3, Number(config.pageDurationSeconds) || 10),
		fontFamily: textSetting(config.fontFamily, '\'Segoe UI\', Arial, sans-serif'),
		...palette
	};
}
