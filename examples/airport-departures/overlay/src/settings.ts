import type { ConfigValues, Settings } from '@interfaces/application.interface';

const textSetting = (value: string | undefined, fallback: string): string => {
	return typeof value === 'string' && value.trim() !== '' ? value : fallback;
};

export default function mapSettings(config: ConfigValues): Settings {
	return {
		airportCode: textSetting(config.airportCode, 'BUD'),
		airportName: textSetting(config.airportName, 'Budapest Airport'),
		boardTitle: textSetting(config.boardTitle, 'Departures'),
		terminalLabel: textSetting(config.terminalLabel, 'Terminal 2'),
		informationLabel: textSetting(config.informationLabel, 'Live flight information'),
		emptyStateText: textSetting(config.emptyStateText, 'No departures are currently listed.'),
		pageDurationSeconds: Math.max(3, Number(config.pageDurationSeconds) || 10),
		backgroundColor: textSetting(config.backgroundColor, '#111315'),
		textColor: textSetting(config.textColor, '#f5f6f3'),
		accentColor: textSetting(config.accentColor, '#f4c542')
	};
}
