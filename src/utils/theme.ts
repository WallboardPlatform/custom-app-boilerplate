export type ThemePreset = 'dark' | 'light' | 'custom';

export interface ThemePalettes<T extends Record<string, string>> {
	dark: T;
	light: T;
	custom: T;
}

type RgbColor = readonly [number, number, number];

const parseHexColor = (value: string): RgbColor | undefined => {
	const normalized: string = value.trim().replace(/^#/, '');
	const expanded: string = normalized.length === 3
		? normalized.split('').map((character: string): string => `${character}${character}`).join('')
		: normalized;

	if (!/^[\da-f]{6}$/i.test(expanded)) {
		return undefined;
	}

	return [
		Number.parseInt(expanded.slice(0, 2), 16),
		Number.parseInt(expanded.slice(2, 4), 16),
		Number.parseInt(expanded.slice(4, 6), 16)
	];
};

const formatHexColor = (color: RgbColor): string => {
	return `#${color.map((channel: number): string => Math.round(channel).toString(16).padStart(2, '0')).join('')}`;
};

const relativeLuminance = (color: RgbColor): number => {
	const channels: number[] = color.map((channel: number): number => {
		const normalized: number = channel / 255;

		return normalized <= 0.04045
			? normalized / 12.92
			: ((normalized + 0.055) / 1.055) ** 2.4;
	});

	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const mixHexColors = (base: string, overlay: string, overlayRatio: number): string => {
	const baseColor: RgbColor | undefined = parseHexColor(base);
	const overlayColor: RgbColor | undefined = parseHexColor(overlay);

	if (!baseColor || !overlayColor) {
		return base;
	}

	const ratio: number = Math.max(0, Math.min(1, overlayRatio));
	const mixedColor: RgbColor = [
		baseColor[0] + (overlayColor[0] - baseColor[0]) * ratio,
		baseColor[1] + (overlayColor[1] - baseColor[1]) * ratio,
		baseColor[2] + (overlayColor[2] - baseColor[2]) * ratio
	];

	return formatHexColor(mixedColor);
};

export const contrastRatio = (left: string, right: string): number => {
	const leftColor: RgbColor | undefined = parseHexColor(left);
	const rightColor: RgbColor | undefined = parseHexColor(right);

	if (!leftColor || !rightColor) {
		return 1;
	}

	const lighter: number = Math.max(relativeLuminance(leftColor), relativeLuminance(rightColor));
	const darker: number = Math.min(relativeLuminance(leftColor), relativeLuminance(rightColor));

	return (lighter + 0.05) / (darker + 0.05);
};

export const readableTextColor = (
	background: string,
	light = '#f7f8f6',
	dark = '#111315'
): string => {
	return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
};

export const themePresetSetting = (value: unknown): ThemePreset => {
	if (value === 'dark' || value === 'light') {
		return value;
	}

	return 'custom';
};

export const resolveTheme = <T extends Record<string, string>>(
	preset: ThemePreset,
	palettes: ThemePalettes<T>
): T => {
	return palettes[preset];
};
