import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	const palette = resolveTheme(themePresetSetting(config.themePreset), {
		dark: { backgroundColor: '#111315', textColor: '#f5f6f3', accentColor: '#f4c542' },
		light: { backgroundColor: '#eef3f4', textColor: '#17313a', accentColor: '#b67d00' },
		custom: {
			backgroundColor: textSetting(config.backgroundColor, '#111315'),
			textColor: textSetting(config.textColor, '#f5f6f3'),
			accentColor: textSetting(config.accentColor, '#f4c542')
		}
	});

	return {
		airportCode: textSetting(config.airportCode, 'BUD'),
		airportName: textSetting(config.airportName, 'Budapest Airport'),
		boardTitle: textSetting(config.boardTitle, 'Departures'),
		terminalLabel: textSetting(config.terminalLabel, 'Terminal 2'),
		informationLabel: textSetting(config.informationLabel, 'Live flight information'),
		emptyStateText: textSetting(config.emptyStateText, 'No departures are currently listed.'),
		pageDurationSeconds: Math.max(3, Number(config.pageDurationSeconds) || 10),
		...palette
	};
}
