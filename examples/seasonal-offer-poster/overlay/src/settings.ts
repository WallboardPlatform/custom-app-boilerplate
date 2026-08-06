import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	const parsed: number = Number(value);

	return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
};

const booleanSetting = (value: boolean | undefined, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

export default (config: ConfigValues): Settings => {
	return {
		brandName: textSetting(config.brandName, 'Fernbrook Market'),
		canvasColor: textSetting(config.canvasColor, '#0f2a24'),
		inkColor: textSetting(config.inkColor, '#f6f1e4'),
		accentColor: textSetting(config.accentColor, '#e4a03c'),
		/*
		 * The surround behind the letterbox. It is a separate setting from the canvas because it is
		 * not part of the artwork: it is whatever the operator wants the unused screen edge to be,
		 * and matching it to the room is often better than matching it to the poster.
		 */
		letterboxColor: textSetting(config.letterboxColor, '#07100e'),
		rotationSeconds: numberSetting(config.rotationSeconds, 12, 4, 120),
		showValidity: booleanSetting(config.showValidity, true),
		emptyStateText: textSetting(config.emptyStateText, 'No offer is scheduled right now.')
	};
};
