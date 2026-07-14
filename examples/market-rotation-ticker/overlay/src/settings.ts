import type { ConfigValues, FontSettings, RawFontSettings, Settings } from '@interfaces/application.interface';

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
		tickerFont: fontSetting(config.tickerFont, 34, '#ffffff'),
		priceFont: fontSetting(config.priceFont, 28, '#ffffff'),
		changeFont: fontSetting(config.changeFont, 21, '#ffffff'),
		upIconFile: config.upIconFile,
		downIconFile: config.downIconFile,
		backgroundColor: textSetting(config.backgroundColor, '#000000'),
		exchangeTitleColor: textSetting(config.exchangeTitleColor, '#ff1f2d'),
		upColor: textSetting(config.upColor, '#4fe34f'),
		downColor: textSetting(config.downColor, '#ff2435'),
		fallbackIconBackground: textSetting(config.fallbackIconBackground, '#20252b'),
		emptyStateText: textSetting(config.emptyStateText, 'No valid market data is available.')
	};
}
