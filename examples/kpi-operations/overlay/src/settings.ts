import type { ConfigValues, Settings } from '@interfaces/application.interface';

export default function mapSettings(config: ConfigValues): Settings {
	return {
		title: config.titleText ?? 'Operations pulse',
		subtitle: config.subtitleText ?? 'Live fulfillment performance',
		emptyState: config.emptyStateText ?? 'No operational data is available.',
		targetLabel: config.targetLabel ?? 'Daily target',
		targetValue: Math.max(1, config.targetValue ?? 2400),
		fontFamily: config.fontFamily ?? '\'Segoe UI\', Arial, sans-serif',
		backgroundColor: config.backgroundColor ?? '#101416',
		surfaceColor: config.surfaceColor ?? '#1b2226',
		primaryTextColor: config.primaryTextColor ?? '#f4f1e8',
		secondaryTextColor: config.secondaryTextColor ?? '#aab5ba',
		accentColor: config.accentColor ?? '#63d7ff',
		positiveColor: config.positiveColor ?? '#63e6bd',
		warningColor: config.warningColor ?? '#ffbf69'
	};
}
