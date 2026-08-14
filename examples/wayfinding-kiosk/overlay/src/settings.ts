import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default (config: ConfigValues): Settings => {
	const preset = config.themePreset === 'light' || config.themePreset === 'custom'
		? config.themePreset
		: 'dark';
	const palette = preset === 'light'
		? {
			accentColor: '#0d7568',
			backgroundColor: '#e8efed',
			mutedColor: '#5c706c',
			panelColor: '#f8fbfa',
			textColor: '#132522'
		}
		: {
			accentColor: '#67e0c4',
			backgroundColor: '#0a1110',
			mutedColor: '#91a8a3',
			panelColor: '#111b19',
			textColor: '#f4faf8'
		};

	return {
		venueName: textSetting(config.venueName, 'Northline Campus'),
		welcomeMessage: textSetting(config.welcomeMessage, 'Where would you like to go?'),
		mobileAppUrl: textSetting(config.mobileAppUrl, 'https://apps.wallboard.us/ba933fe4-c587-47fc-8834-ef534facc4c0/'),
		themePreset: preset,
		accentColor: preset === 'custom' ? textSetting(config.accentColor, palette.accentColor) : palette.accentColor,
		textColor: preset === 'custom' ? textSetting(config.textColor, palette.textColor) : palette.textColor,
		backgroundColor: preset === 'custom' ? textSetting(config.backgroundColor, palette.backgroundColor) : palette.backgroundColor,
		panelColor: preset === 'custom' ? textSetting(config.panelColor, palette.panelColor) : palette.panelColor,
		mutedColor: preset === 'custom' ? textSetting(config.mutedColor, palette.mutedColor) : palette.mutedColor
	};
};
