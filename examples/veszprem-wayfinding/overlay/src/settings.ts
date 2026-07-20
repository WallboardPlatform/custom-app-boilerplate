import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { motionPreset } from '@utils/motion';
import { resolveTheme, themePresetSetting } from '@utils/theme';
import type { ThemePreset } from '@utils/theme';

interface WayfindingPalette {
	accentColor: string;
	backgroundColor: string;
	panelColor: string;
	primaryTextColor: string;
	routeColor: string;
	secondaryTextColor: string;
}

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
};

const numberSetting = (value: number | undefined, fallback: number, minimum: number, maximum: number): number => {
	const numericValue: number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;

	return Math.min(maximum, Math.max(minimum, numericValue));
};

const booleanSetting = (value: boolean | undefined, fallback: boolean): boolean => {
	return typeof value === 'boolean' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	const themePreset: ThemePreset = themePresetSetting(config.themePreset);
	const palette: WayfindingPalette = resolveTheme(themePreset, {
		dark: {
			accentColor: '#f0b941',
			backgroundColor: '#122726',
			panelColor: '#173331',
			primaryTextColor: '#fff8e9',
			routeColor: '#e33f33',
			secondaryTextColor: '#b9cbc5'
		},
		light: {
			accentColor: '#d08b2e',
			backgroundColor: '#ead9c8',
			panelColor: '#fff9ef',
			primaryTextColor: '#17312f',
			routeColor: '#cf332b',
			secondaryTextColor: '#5d716d'
		},
		custom: {
			accentColor: textSetting(config.accentColor, '#d08b2e'),
			backgroundColor: textSetting(config.backgroundColor, '#ead9c8'),
			panelColor: textSetting(config.panelColor, '#fff9ef'),
			primaryTextColor: textSetting(config.primaryTextColor, '#17312f'),
			routeColor: textSetting(config.routeColor, '#cf332b'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#5d716d')
		}
	});

	return {
		...palette,
		emptyStateText: textSetting(config.emptyStateText, 'No destinations are available.'),
		interfaceLanguages: config.interfaceLanguages === 'en' || config.interfaceLanguages === 'hu' ? config.interfaceLanguages : 'en-hu',
		keyboardLanguages: config.keyboardLanguages === 'en' || config.keyboardLanguages === 'hu' ? config.keyboardLanguages : 'hu-en',
		mapRatio: numberSetting(config.mapRatio, 0.8, 0.2, 5),
		motionPreset: motionPreset(config.motionPreset),
		onScreenKeyboard: booleanSetting(config.onScreenKeyboard, true),
		routeResetSeconds: numberSetting(config.routeResetSeconds, 45, 10, 180),
		startLocationId: textSetting(config.startLocationId, 'tourinform-veszprem'),
		subtitle: textSetting(config.subtitle, 'Choose a landmark or tap its number on the map.'),
		themePreset,
		title: textSetting(config.title, 'Veszprem Downtown Wayfinding')
	};
}
