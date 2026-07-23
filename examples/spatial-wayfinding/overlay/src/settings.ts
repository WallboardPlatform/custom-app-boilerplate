import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { motionPreset } from '@utils/motion';
import { resolveTheme, themePresetSetting } from '@utils/theme';
import type { ThemePreset } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => typeof value === 'string' && value.trim() ? value.trim() : fallback;

export default function mapSettings(config: ConfigValues): Settings {
	const themePreset: ThemePreset = themePresetSetting(config.themePreset);
	const palette = resolveTheme(themePreset, {
		dark: {
			accentColor: '#f0be4d',
			backgroundColor: '#111817',
			panelColor: '#182321',
			primaryTextColor: '#f6f3e8',
			secondaryTextColor: '#9db0aa'
		},
		light: {
			accentColor: '#bd6d1d',
			backgroundColor: '#e8ece7',
			panelColor: '#fffdf7',
			primaryTextColor: '#15302b',
			secondaryTextColor: '#667973'
		},
		custom: {
			accentColor: textSetting(config.accentColor, '#bd6d1d'),
			backgroundColor: textSetting(config.backgroundColor, '#e8ece7'),
			panelColor: textSetting(config.panelColor, '#fffdf7'),
			primaryTextColor: textSetting(config.primaryTextColor, '#15302b'),
			secondaryTextColor: textSetting(config.secondaryTextColor, '#667973')
		}
	});

	return {
		...palette,
		defaultView: config.defaultView === '2d' ? '2d' : '3d',
		motionPreset: motionPreset(config.motionPreset ?? 'subtle'),
		showViewSwitcher: config.showViewSwitcher !== false,
		themePreset,
		title: textSetting(config.title, 'Northline Campus')
	};
}
