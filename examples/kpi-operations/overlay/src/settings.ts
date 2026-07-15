import type { ConfigValues, Settings } from '@interfaces/application.interface';

import { resolveTheme, themePresetSetting } from '@utils/theme';

export default function mapSettings(config: ConfigValues): Settings {
	const palette = resolveTheme(themePresetSetting(config.themePreset), {
		dark: {
			backgroundColor: '#101416', surfaceColor: '#1b2226', primaryTextColor: '#f4f1e8',
			secondaryTextColor: '#aab5ba', accentColor: '#63d7ff', positiveColor: '#63e6bd', warningColor: '#ffbf69'
		},
		light: {
			backgroundColor: '#eef3f6', surfaceColor: '#ffffff', primaryTextColor: '#17313a',
			secondaryTextColor: '#617581', accentColor: '#167ea6', positiveColor: '#258b68', warningColor: '#b97013'
		},
		custom: {
			backgroundColor: config.backgroundColor ?? '#101416',
			surfaceColor: config.surfaceColor ?? '#1b2226',
			primaryTextColor: config.primaryTextColor ?? '#f4f1e8',
			secondaryTextColor: config.secondaryTextColor ?? '#aab5ba',
			accentColor: config.accentColor ?? '#63d7ff',
			positiveColor: config.positiveColor ?? '#63e6bd',
			warningColor: config.warningColor ?? '#ffbf69'
		}
	});

	return {
		title: config.titleText ?? 'Operations pulse',
		subtitle: config.subtitleText ?? 'Live fulfillment performance',
		emptyState: config.emptyStateText ?? 'No operational data is available.',
		targetLabel: config.targetLabel ?? 'Daily target',
		targetValue: Math.max(1, config.targetValue ?? 2400),
		fontFamily: config.fontFamily ?? '\'Segoe UI\', Arial, sans-serif',
		...palette
	};
}
