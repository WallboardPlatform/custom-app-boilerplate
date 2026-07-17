import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Number(value))) : fallback;
};

export default (config: ConfigValues): Settings => ({
	accentColor: textSetting(config.accentColor, '#ef5b45'),
	backgroundColor: textSetting(config.backgroundColor, '#071313'),
	borderColor: textSetting(config.borderColor, '#29413e'),
	dangerColor: textSetting(config.dangerColor, '#ff6c5c'),
	fontFamily: textSetting(config.fontFamily, 'Arial'),
	maximumRows: numberSetting(config.maximumRows, 6, 3, 12),
	passColor: textSetting(config.passColor, '#59ddaf'),
	passThreshold: numberSetting(config.passThreshold, 80, 1, 100),
	plantName: textSetting(config.plantName, 'Northline Mobility'),
	primaryTextColor: textSetting(config.primaryTextColor, '#f7f2e8'),
	secondaryTextColor: textSetting(config.secondaryTextColor, '#9eb4ae'),
	showCorporateId: config.showCorporateId === true,
	surfaceColor: textSetting(config.surfaceColor, '#102321'),
	surfaceStrongColor: textSetting(config.surfaceStrongColor, '#17302d'),
	themePreset: config.themePreset === 'light' || config.themePreset === 'custom' ? config.themePreset : 'dark',
	title: textSetting(config.title, 'Safety readiness dashboard')
});
