import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default (config: ConfigValues): Settings => {
	return {
		title: textSetting(config.title, 'Your custom app'),
		accentColor: textSetting(config.accentColor, '#15c39a'),
		textColor: textSetting(config.textColor, '#f4f7f6'),
		backgroundColor: textSetting(config.backgroundColor, '#111516')
	};
};
