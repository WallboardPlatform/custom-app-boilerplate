import type { ConfigValues, Settings } from '@interfaces/application.interface';
import { readableTextColor, resolveTheme, themePresetSetting } from '@utils/theme';
import type { ThemePalettes, ThemePreset } from '@utils/theme';

interface MuseumPalette extends Record<string, string> {
	backgroundColor: string;
	primaryColor: string;
	secondaryColor: string;
	accentColor: string;
	textColor: string;
	inverseTextColor: string;
	groundTextColor: string;
	primaryTextColor: string;
	primaryMetaTextColor: string;
	secondaryTextColor: string;
	accentTextColor: string;
	ringColor: string;
}

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const booleanSetting = (value: boolean | undefined, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

const imageSetting = (value: unknown): string => {
	if (typeof value === 'string') {
		return value.trim();
	}

	if (value && typeof value === 'object') {
		const candidate: Record<string, unknown> = value as Record<string, unknown>;

		for (const key of ['url', 'src', 'path']) {
			if (typeof candidate[key] === 'string' && candidate[key].trim() !== '') {
				return candidate[key].trim();
			}
		}
	}

	return '';
};

const lightPalette: MuseumPalette = {
	backgroundColor: '#eeeae2',
	primaryColor: '#ed3f2f',
	secondaryColor: '#185bd8',
	accentColor: '#f3c625',
	textColor: '#111111',
	inverseTextColor: '#eeeae2',
	groundTextColor: '#111111',
	primaryTextColor: '#eeeae2',
	primaryMetaTextColor: '#111111',
	secondaryTextColor: '#eeeae2',
	accentTextColor: '#111111',
	ringColor: '#111111'
};

const darkPalette: MuseumPalette = {
	backgroundColor: '#151515',
	primaryColor: '#cf493b',
	secondaryColor: '#2857b6',
	accentColor: '#dcb92b',
	textColor: '#111111',
	inverseTextColor: '#f3eee4',
	groundTextColor: '#f3eee4',
	primaryTextColor: '#f3eee4',
	primaryMetaTextColor: '#f3eee4',
	secondaryTextColor: '#f3eee4',
	accentTextColor: '#111111',
	ringColor: '#f3eee4'
};

export default (config: ConfigValues): Settings => {
	const themePreset: ThemePreset = themePresetSetting(config.themePreset);
	const textColor: string = textSetting(config.textColor, '#111111');
	const inverseTextColor: string = textSetting(config.inverseTextColor, '#eeeae2');
	const customPalette: MuseumPalette = {
		backgroundColor: textSetting(config.backgroundColor, '#eeeae2'),
		primaryColor: textSetting(config.primaryColor, '#ed3f2f'),
		secondaryColor: textSetting(config.secondaryColor, '#185bd8'),
		accentColor: textSetting(config.accentColor, '#f3c625'),
		textColor,
		inverseTextColor,
		groundTextColor: textColor,
		primaryTextColor: inverseTextColor,
		primaryMetaTextColor: readableTextColor(
			textSetting(config.primaryColor, '#ed3f2f'),
			inverseTextColor,
			textColor
		),
		secondaryTextColor: inverseTextColor,
		accentTextColor: textColor,
		ringColor: textColor
	};
	const palettes: ThemePalettes<MuseumPalette> = {
		light: lightPalette,
		dark: darkPalette,
		custom: customPalette
	};
	const palette: MuseumPalette = resolveTheme(themePreset, palettes);

	return {
		exhibitionTitle: textSetting(config.exhibitionTitle, 'FORM IN MOTION'),
		subtitle: textSetting(config.subtitle, 'Kinetic sculpture and modern light'),
		dateRange: textSetting(config.dateRange, '14 SEP - 22 JAN'),
		venue: textSetting(config.venue, 'GALLERY 2'),
		heroImage: imageSetting(config.heroImage),
		showSubtitle: booleanSetting(config.showSubtitle, true),
		showDate: booleanSetting(config.showDate, true),
		showVenue: booleanSetting(config.showVenue, true),
		showImage: booleanSetting(config.showImage, true),
		transparentBackground: booleanSetting(config.transparentBackground, false),
		themePreset,
		...palette
	};
};
