import type {
	ConfigValues,
	DateFormat,
	HourFormat,
	Settings
} from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	const parsedValue: number = Number(value);

	if (!Number.isFinite(parsedValue)) {
		return fallback;
	}

	return Math.min(maximum, Math.max(minimum, parsedValue));
};

const booleanSetting = (value: boolean | undefined, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

const hourFormatSetting = (value: string | undefined): HourFormat => {
	return value === '12' ? '12' : '24';
};

const dateFormatSetting = (value: string | undefined): DateFormat => {
	return value === 'compact' || value === 'long' ? value : 'medium';
};

export default (config: ConfigValues): Settings => {
	return {
		locationLabel: textSetting(config.locationLabel, 'Budapest'),
		timezone: textSetting(config.timezone, 'Europe/Budapest'),
		hourFormat: hourFormatSetting(config.hourFormat),
		dateFormat: dateFormatSetting(config.dateFormat),
		showSeconds: booleanSetting(config.showSeconds, true),
		showDate: booleanSetting(config.showDate, true),
		showZone: booleanSetting(config.showZone, true),
		fontScale: numberSetting(config.fontScale, 100, 70, 140),
		accentColor: textSetting(config.accentColor, '#58e4c1'),
		textColor: textSetting(config.textColor, '#f6f4ed'),
		backgroundColor: textSetting(config.backgroundColor, '#101516'),
		backgroundOpacity: numberSetting(config.backgroundOpacity, 94, 0, 100)
	};
};
