import type { ConfigValues, FloorId, InterfaceLanguages, KeyboardLanguages, Settings } from '@interfaces/application.interface';

import { motionPreset } from '@utils/motion';
import { resolveTheme, themePresetSetting } from '@utils/theme';
import type { ThemePreset } from '@utils/theme';

interface DirectoryPalette {
	accentColor: string;
	backgroundColor: string;
	destinationColor: string;
	mapSurfaceColor: string;
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

const languageSetting = (value: string | undefined): InterfaceLanguages => {
	return value === 'en' || value === 'es' ? value : 'en-es';
};

const keyboardLanguageSetting = (value: string | undefined): KeyboardLanguages => {
	return value === 'en' || value === 'es' ? value : 'en-es';
};

const floorSetting = (value: string | undefined): FloorId => {
	return value === '2' || value === '3' ? value : '1';
};

export default function mapSettings(config: ConfigValues): Settings {
	const themePreset: ThemePreset = themePresetSetting(config.themePreset);
	const palette: DirectoryPalette = resolveTheme(themePreset, {
		dark: {
			accentColor: '#f0b84a',
			backgroundColor: '#102a32',
			destinationColor: '#3fc3a8',
			routeColor: '#ff7668',
			mapSurfaceColor: '#1a3c43',
			panelColor: '#122f36',
			primaryTextColor: '#fff9ef',
			secondaryTextColor: '#b9ced0'
		},
		light: {
			accentColor: '#b96734',
			backgroundColor: '#e7e0d4',
			destinationColor: '#217f79',
			routeColor: '#c83f32',
			mapSurfaceColor: '#f5f0e7',
			panelColor: '#fffdf8',
			primaryTextColor: '#173039',
			secondaryTextColor: '#5b6e72'
		},
		custom: {
			accentColor: textSetting(config.accentColor, '#b96734'),
			backgroundColor: textSetting(config.backgroundColor, '#e7e0d4'),
			destinationColor: textSetting(config.destinationColor, '#217f79'),
			routeColor: textSetting(config.routeColor, '#c83f32'),
			mapSurfaceColor: textSetting(config.mapSurfaceColor, '#f5f0e7'),
			panelColor: textSetting(config.panelColor, '#fffdf8'),
			primaryTextColor: textSetting(config.primaryTextColor, '#173039'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#5b6e72')
		}
	});

	return {
		...palette,
		emptyStateText: textSetting(config.emptyStateText, 'No destinations are available.'),
		guidanceMode: config.guidanceMode === 'directory' || config.guidanceMode === 'highlight' ? config.guidanceMode : 'route',
		initialFloor: floorSetting(config.initialFloor),
		interfaceLanguages: languageSetting(config.interfaceLanguages),
		keyboardLanguages: keyboardLanguageSetting(config.keyboardLanguages),
		motionPreset: motionPreset(config.motionPreset),
		onScreenKeyboard: typeof config.onScreenKeyboard === 'boolean' ? config.onScreenKeyboard : true,
		selectionResetSeconds: numberSetting(config.selectionResetSeconds, 60, 15, 300),
		startLocationId: textSetting(config.startLocationId, 'main-lobby'),
		subtitle: textSetting(config.subtitle, 'Find departments and public services across three levels.'),
		themePreset,
		title: textSetting(config.title, 'Civic Building Directory')
	};
}
