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
		backgroundColor: textSetting(config.backgroundColor, '#eef2f5'),
		surfaceColor: textSetting(config.surfaceColor, '#ffffff'),
		primaryTextColor: textSetting(config.primaryTextColor, '#142437'),
		secondaryTextColor: textSetting(config.secondaryTextColor, '#657587'),
		accentColor: textSetting(config.accentColor, '#2674c8'),
		successColor: textSetting(config.successColor, '#3d9b68'),
		warningColor: textSetting(config.warningColor, '#d89118'),
		dangerColor: textSetting(config.dangerColor, '#cf4848')
	};
}
