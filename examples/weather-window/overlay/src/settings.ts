import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const forecastDays = (value: number | undefined): number => {
	const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 4;

	return Math.min(5, Math.max(3, Math.round(numericValue)));
};

export default (config: ConfigValues): Settings => ({
	cityCode: textSetting(config.cityCode, 'Budapest'),
	countryCode: textSetting(config.countryCode, 'HU').toUpperCase(),
	displayName: typeof config.displayName === 'string' ? config.displayName.trim() : '',
	temperatureUnit: config.temperatureUnit === 'F' ? 'F' : 'C',
	languageCode: textSetting(config.languageCode, 'en-US'),
	forecastDays: forecastDays(config.forecastDays),
	backgroundType: config.backgroundType === 'Urban'
		|| config.backgroundType === 'Village_and_Countryside'
		|| config.backgroundType === 'none'
		? config.backgroundType
		: 'Ocean_and_Rocky_Coast',
	motionPreset: config.motionPreset === 'off' ? 'off' : 'subtle'
});
