import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	return {
		title: textSetting(config.titleText, 'Agent status wall'),
		subtitle: textSetting(config.subtitleText, 'Live workforce activity'),
		emptyState: textSetting(config.emptyStateText, 'No agent records are currently available.'),
		pageDurationSeconds: Math.max(3, Number(config.pageDurationSeconds) || 10),
		fontFamily: textSetting(config.fontFamily, '\'Segoe UI\', Arial, sans-serif'),
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
	};
}
