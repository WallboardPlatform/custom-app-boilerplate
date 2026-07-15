export type ThemePreset = 'dark' | 'light' | 'custom';

export interface ThemePalettes<T extends Record<string, string>> {
	dark: T;
	light: T;
	custom: T;
}

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
