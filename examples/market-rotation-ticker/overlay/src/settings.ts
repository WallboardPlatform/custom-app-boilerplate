import type { ConfigValues, FontSettings, RawFontSettings, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	const parsedValue: number = Number(value);

	if (!Number.isFinite(parsedValue)) {
		return fallback;
	}

	return Math.min(maximum, Math.max(minimum, parsedValue));
};

const fontSetting = (
	value: RawFontSettings | undefined,
	fallbackSize: number,
	fallbackColor: string
): FontSettings => ({
	family: textSetting(value?.['font-family']?.toString(), 'Arial Narrow, Arial, sans-serif'),
	size: numberSetting(Number(value?.['font-size']), fallbackSize, 8, 160),
	style: textSetting(value?.['font-style'], 'normal'),
	weight: textSetting(value?.['font-weight']?.toString(), '700'),
	color: textSetting(value?.color, fallbackColor),
	decoration: textSetting(value?.['text-decoration'], 'none')
});

export default function mapSettings(config: ConfigValues): Settings {
	const themePreset = themePresetSetting(config.themePreset);
	const palette = resolveTheme(themePreset, {
		dark: {
			backgroundColor: '#000000', exchangeTitleColor: '#ff1f2d', upColor: '#4fe34f',
			downColor: '#ff2435', fallbackIconBackground: '#20252b', textColor: '#ffffff'
		},
		light: {
			backgroundColor: '#f5f7f8', exchangeTitleColor: '#c71f2b', upColor: '#198a46',
			downColor: '#c93440', fallbackIconBackground: '#dfe5e8', textColor: '#14202a'
		},
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#000000'),
			exchangeTitleColor: textSetting(config.exchangeTitleColor, '#ff1f2d'),
			upColor: textSetting(config.upColor, '#4fe34f'),
			downColor: textSetting(config.downColor, '#ff2435'),
			fallbackIconBackground: textSetting(config.fallbackIconBackground, '#20252b'),
			textColor: '#ffffff'
		}
	});
	const marketLabelFont = fontSetting(config.marketLabelFont, 28, '#ff1f2d');
	const tickerFont = fontSetting(config.tickerFont, 34, '#ffffff');
	const priceFont = fontSetting(config.priceFont, 28, '#ffffff');
	const changeFont = fontSetting(config.changeFont, 21, '#ffffff');
	const presetTextColor: string | undefined = themePreset === 'custom' ? undefined : palette.textColor;

	return {
		nasdaqLabel: textSetting(config.nasdaqLabel, 'NASDAQ 100'),
		tsxLabel: textSetting(config.tsxLabel, 'TSX60: TORONTO STOCK EXCHANGE'),
		dowLabel: textSetting(config.dowLabel, 'DJ30: DOW JONES'),
		fxLabel: textSetting(config.fxLabel, 'CAD AND USD FX'),
		exchangeTitleSeconds: numberSetting(config.exchangeTitleSeconds, 8, 1, 60),
		speedPixelsPerSecond: numberSetting(config.speedPixelsPerSecond, 140, 10, 4000),
		verticalMargin: numberSetting(config.verticalMargin, 4, 0, 40),
		itemMargin: numberSetting(config.itemMargin, 22, 0, 100),
		logoScale: numberSetting(config.logoScale, 72, 20, 100),
		marketLabelFont: { ...marketLabelFont, color: themePreset === 'custom' ? marketLabelFont.color : palette.exchangeTitleColor },
		tickerFont: { ...tickerFont, color: presetTextColor ?? tickerFont.color },
		priceFont: { ...priceFont, color: presetTextColor ?? priceFont.color },
		changeFont: { ...changeFont, color: presetTextColor ?? changeFont.color },
		upIconFile: config.upIconFile,
		downIconFile: config.downIconFile,
		backgroundColor: palette.backgroundColor,
		textColor: palette.textColor,
		exchangeTitleColor: palette.exchangeTitleColor,
		upColor: palette.upColor,
		downColor: palette.downColor,
		fallbackIconBackground: palette.fallbackIconBackground,
		emptyStateText: textSetting(config.emptyStateText, 'No valid market data is available.')
	};
}
