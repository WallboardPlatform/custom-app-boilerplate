import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	return {
		title: textSetting(config.titleText, 'Unit group pulse'),
		subtitle: textSetting(config.subtitleText, 'Live call-center performance'),
		emptyState: textSetting(config.emptyStateText, 'No unit metrics are currently available.'),
		rotationSeconds: Math.max(3, Number(config.rotationSeconds) || 10),
		excludedGroups: textSetting(config.excludedGroups, 'All BGE,TOTAL,Other'),
		hideInactiveGroups: config.hideInactiveGroups === true,
		fontFamily: textSetting(config.fontFamily, '\'Segoe UI\', Arial, sans-serif'),
		backgroundColor: textSetting(config.backgroundColor, '#101416'),
		surfaceColor: textSetting(config.surfaceColor, '#1b2226'),
		primaryTextColor: textSetting(config.primaryTextColor, '#f4f1e8'),
		secondaryTextColor: textSetting(config.secondaryTextColor, '#aab5ba'),
		accentColor: textSetting(config.accentColor, '#58c7f3'),
		successColor: textSetting(config.successColor, '#56d6a7'),
		warningColor: textSetting(config.warningColor, '#f5b942'),
		dangerColor: textSetting(config.dangerColor, '#ff6b6b')
	};
}
