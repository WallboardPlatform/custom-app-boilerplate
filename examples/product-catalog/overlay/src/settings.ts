import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

	return Math.min(maximum, Math.max(minimum, numericValue));
};

export default (config: ConfigValues): Settings => ({
	brandLabel: textSetting(config.brandLabel, 'FIELD NOTE / OBJECTS FOR EVERYDAY'),
	collectionTitle: textSetting(config.collectionTitle, 'Useful things, considered.'),
	emptyStateText: textSetting(config.emptyStateText, 'The next collection is being prepared.'),
	pageDurationSeconds: numberSetting(config.pageDurationSeconds, 8, 3, 60),
	motionPreset: config.motionPreset === 'off' || config.motionPreset === 'expressive' ? config.motionPreset : 'subtle',
	mediaFit: config.mediaFit === 'contain' ? 'contain' : 'cover',
	backgroundColor: textSetting(config.backgroundColor, '#f3efdf'),
	textColor: textSetting(config.textColor, '#112d2a'),
	mutedTextColor: textSetting(config.mutedTextColor, '#5a6964'),
	accentColor: textSetting(config.accentColor, '#ef4b3e'),
	panelColor: textSetting(config.panelColor, '#d6e5dd')
});
