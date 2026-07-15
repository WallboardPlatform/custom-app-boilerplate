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
		backgroundColor: textSetting(config.backgroundColor, '#111416'),
		surfaceColor: textSetting(config.surfaceColor, '#1c2225'),
		primaryTextColor: textSetting(config.primaryTextColor, '#f5f3ec'),
		secondaryTextColor: textSetting(config.secondaryTextColor, '#aab3b7'),
		readyColor: textSetting(config.readyColor, '#4fd3a3'),
		activeColor: textSetting(config.activeColor, '#ff6666'),
		acwColor: textSetting(config.acwColor, '#f4bd4f'),
		awayColor: textSetting(config.awayColor, '#e98a50'),
		offlineColor: textSetting(config.offlineColor, '#758087'),
		unknownColor: textSetting(config.unknownColor, '#68a7d3')
	};
}
