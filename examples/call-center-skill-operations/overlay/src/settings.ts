import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	return {
		title: textSetting(config.titleText, 'Skill operations'),
		subtitle: textSetting(config.subtitleText, 'Live coverage and agent activity'),
		emptyState: textSetting(config.emptyStateText, 'No active skill records are currently available.'),
		rotationSeconds: Math.max(3, Number(config.rotationSeconds) || 10),
		maxAgentsShown: Math.max(4, Math.min(24, Number(config.maxAgentsShown) || 12)),
		fontFamily: textSetting(config.fontFamily, '\'Segoe UI\', Arial, sans-serif'),
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
	};
}
