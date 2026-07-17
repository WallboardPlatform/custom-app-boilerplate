import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Number(value))) : fallback;
};

export default (config: ConfigValues): Settings => ({
	plantName: textSetting(config.plantName, 'Northline Mobility'),
	welcomeTitle: textSetting(config.welcomeTitle, 'Ready for your safety check?'),
	introText: textSetting(config.introText, 'Three quick questions help keep every production zone safe.'),
	identityPrompt: textSetting(config.identityPrompt, 'Enter your name and corporate ID to begin.'),
	completionResetSeconds: numberSetting(config.completionResetSeconds, 10, 3, 120),
	inactivityResetSeconds: numberSetting(config.inactivityResetSeconds, 120, 30, 900),
	motionPreset: config.motionPreset === 'off' || config.motionPreset === 'expressive' ? config.motionPreset : 'subtle',
	themePreset: config.themePreset === 'light' || config.themePreset === 'custom' ? config.themePreset : 'dark',
	backgroundColor: textSetting(config.backgroundColor, '#071313'),
	surfaceColor: textSetting(config.surfaceColor, '#102322'),
	primaryTextColor: textSetting(config.primaryTextColor, '#f7f2e8'),
	secondaryTextColor: textSetting(config.secondaryTextColor, '#a9bfba'),
	accentColor: textSetting(config.accentColor, '#e64b38')
});
