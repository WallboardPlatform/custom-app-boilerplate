import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	const palette = resolveTheme(themePresetSetting(config.themePreset), {
		dark: {
			backgroundColor: '#0e171d',
			surfaceColor: '#18242b',
			primaryTextColor: '#f4f7f6',
			secondaryTextColor: '#9db0b8',
			accentColor: '#63b3ed',
			successColor: '#58d0a2',
			warningColor: '#f2ba55',
			dangerColor: '#ef6a6a'
		},
		light: {
			backgroundColor: '#eef2f5',
			surfaceColor: '#ffffff',
			primaryTextColor: '#142437',
			secondaryTextColor: '#657587',
			accentColor: '#2674c8',
			successColor: '#3d9b68',
			warningColor: '#d89118',
			dangerColor: '#cf4848'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#eef2f5'),
			surfaceColor: textSetting(config.surfaceColor, '#ffffff'),
			primaryTextColor: textSetting(config.primaryTextColor, '#142437'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#657587'),
			accentColor: textSetting(config.accentColor, '#2674c8'),
			successColor: textSetting(config.successColor, '#3d9b68'),
			warningColor: textSetting(config.warningColor, '#d89118'),
			dangerColor: textSetting(config.dangerColor, '#cf4848')
		}
	});

	return {
		title: textSetting(config.titleText, 'Unit group pulse'),
		subtitle: textSetting(config.subtitleText, 'Live call-center performance'),
		emptyState: textSetting(config.emptyStateText, 'No unit metrics are currently available.'),
		rotationSeconds: Math.max(3, Number(config.rotationSeconds) || 10),
		excludedGroups: textSetting(config.excludedGroups, 'All BGE,TOTAL,Other'),
		hideInactiveGroups: config.hideInactiveGroups === true,
		fontFamily: textSetting(config.fontFamily, '\'Segoe UI\', Arial, sans-serif'),
		...palette
	};
}
